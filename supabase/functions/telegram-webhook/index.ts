// deno-lint-ignore-file no-explicit-any
// Вебхук Telegram: привязка чата, разбор сообщений через ИИ с подтверждением,
// кнопки «Начать» / «Закончить» у задач.
import { send, edit, answer, esc } from '../_shared/tg.ts';
import { db, rows, putRow, profileByChat, newId, nowISO } from '../_shared/db.ts';
import { parseMessage, type ParsedItem } from '../_shared/ai.ts';
import { renderDraft } from '../_shared/render.ts';
import { localClock, isRunning } from '../_shared/domain.ts';

const SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const DAILY_AI_LIMIT = 200;
/** Черновик ещё ждёт решения пользователя: `pending` — показан, `editing` — нажали «Изменить». */
const OPEN_DRAFT = ['pending', 'editing'];

/** Счётчик запросов к ИИ за сутки. Сутки считаются по часовому поясу пользователя, а не по UTC. */
async function aiAllowed(userId: string, timezone: string): Promise<boolean> {
  const { date } = localClock(new Date(), timezone);
  const { data } = await db.from('ai_usage').select('count').eq('user_id', userId).eq('date', date).maybeSingle();
  const count = (data?.count as number | undefined) ?? 0;
  if (count >= DAILY_AI_LIMIT) return false;
  await db.from('ai_usage').upsert({ user_id: userId, date, count: count + 1 });
  return true;
}

async function saveItems(userId: string, items: ParsedItem[]) {
  const now = nowISO();
  const base = { createdAt: now, updatedAt: now, source: 'telegram' as const };
  const lists = await rows<any>(userId, 'lists');
  const folders = await rows<any>(userId, 'noteFolders');
  const boards = await rows<any>(userId, 'boards');
  const columns = await rows<any>(userId, 'columns');
  for (const i of items) {
    if (i.type === 'task') {
      const board = boards.find((b: any) => (i.area === 'work' ? b.title === 'Работа' : b.title === 'Личное')) ?? boards[0];
      const col = columns.find((c: any) => c.boardId === board?.id && c.kind === 'todo');
      await putRow(userId, 'tasks', {
        id: newId(), title: i.title, area: i.area ?? 'personal', boardId: board?.id, columnId: col?.id,
        goalId: i.goal_id, date: i.date, plannedStart: i.time, plannedMinutes: i.minutes,
        status: 'todo', rescheduleCount: 0, kind: 'task', position: Date.now(), ...base,
      });
    } else if (i.type === 'reminder') {
      await putRow(userId, 'reminders', {
        id: newId(), text: i.title, date: i.date ?? new Date().toISOString().slice(0, 10),
        time: i.time, repeat: i.repeat ?? 'none', ...base,
      });
    } else if (i.type === 'list_item') {
      let list = lists.find((l: any) => l.title.toLowerCase() === (i.list_name ?? 'купить').toLowerCase())
        ?? lists.find((l: any) => l.title === 'Купить')
        ?? lists[0];
      if (!list) {
        list = { id: newId(), title: 'Купить', icon: 'shopping-bag', position: 0, pinned: true, createdAt: now, updatedAt: now };
        await putRow(userId, 'lists', list);
        lists.push(list);
      }
      await putRow(userId, 'listItems', { id: newId(), listId: list.id, text: i.title, position: Date.now(), createdAt: now, updatedAt: now });
    } else {
      const inbox = folders.find((f: any) => f.title === 'Входящие') ?? folders[0];
      await putRow(userId, 'notes', { id: newId(), folderId: inbox?.id, title: i.title.slice(0, 80), body: i.title, ...base });
    }
  }
}

/** Запасной путь: если ИИ недоступен или не понял, текст не теряется — он ложится в блокнот. */
async function saveAsNote(userId: string, text: string) {
  const folders = await rows<any>(userId, 'noteFolders');
  const inbox = folders.find((f: any) => f.title === 'Входящие') ?? folders[0];
  const now = nowISO();
  await putRow(userId, 'notes', {
    id: newId(), folderId: inbox?.id, title: text.slice(0, 80), body: text,
    source: 'telegram', createdAt: now, updatedAt: now,
  });
}

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return new Response('forbidden', { status: 403 });
  const update = await req.json() as any;

  // Кнопки
  if (update.callback_query) {
    const cq = update.callback_query;
    try {
      if (!cq.message?.chat) { await answer(cq.id); return new Response('ok'); }
      const chatId = String(cq.message.chat.id);
      const [action, id] = String(cq.data ?? '').split(':');
      const link = await profileByChat(chatId);
      if (!link) { await answer(cq.id, 'Бот не привязан'); return new Response('ok'); }
      const { userId } = link;

      if (action === 'save' || action === 'cancel') {
        const { data: d } = await db.from('bot_drafts').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
        if (!d || !OPEN_DRAFT.includes(d.status as string)) { await answer(cq.id, 'Уже обработано'); return new Response('ok'); }
        // Статус меняем ДО записи: повторная доставка того же нажатия не найдёт открытый черновик
        // и не сохранит всё второй раз.
        const { data: claimed } = await db.from('bot_drafts')
          .update({ status: action === 'save' ? 'saved' : 'cancelled' })
          .eq('id', id).eq('user_id', userId).in('status', OPEN_DRAFT)
          .select('id');
        if (!claimed?.length) { await answer(cq.id, 'Уже обработано'); return new Response('ok'); }
        if (action === 'save') {
          const items = d.payload as ParsedItem[];
          await saveItems(userId, items);
          await edit(chatId, cq.message.message_id, `✅ Сохранено: ${items.length}`);
        } else {
          await edit(chatId, cq.message.message_id, '✖️ Отменено');
        }
        await answer(cq.id);
      } else if (action === 'edit') {
        // Правкой считается только сообщение после этой кнопки — иначе любой следующий текст
        // подклеивался бы к прошлому разбору.
        const { data: marked } = await db.from('bot_drafts').update({ status: 'editing' })
          .eq('id', id).eq('user_id', userId).in('status', OPEN_DRAFT).select('id');
        if (!marked?.length) { await answer(cq.id, 'Уже обработано'); return new Response('ok'); }
        await answer(cq.id);
        await send(chatId, 'Напиши, что исправить, одним сообщением.');
      } else if (action === 'start' || action === 'finish') {
        const tasks = await rows<any>(userId, 'tasks');
        const t = tasks.find((x: any) => x.id === id);
        if (!t) { await answer(cq.id, 'Задача не найдена'); return new Response('ok'); }
        // Колонки читаем один раз: статус задачи и её место на доске должны совпадать, как в вебе.
        const columns = await rows<any>(userId, 'columns');
        const columnFor = (kind: string) => columns.find((c: any) => c.boardId === t.boardId && c.kind === kind)?.id;
        if (action === 'start') {
          // Мешает только задача с запущенным таймером: статус `doing` без `actualStart` ставит доска.
          const running = tasks.find((x: any) => x.id !== id && isRunning(x));
          if (running) { await answer(cq.id, `Сначала закончи «${running.title}»`); return new Response('ok'); }
          await putRow(userId, 'tasks', {
            ...t, status: 'doing', actualStart: nowISO(), columnId: columnFor('doing') ?? t.columnId, updatedAt: nowISO(),
          });
          await answer(cq.id, '▶ Пошло');
          await send(chatId, `▶ ${esc(t.title)}`, [[{ text: '■ Закончить', callback_data: `finish:${t.id}` }]]);
        } else {
          await putRow(userId, 'tasks', {
            ...t, status: 'done', actualEnd: nowISO(), columnId: columnFor('done') ?? t.columnId, updatedAt: nowISO(),
          });
          await answer(cq.id, '✓ Готово');
          await edit(chatId, cq.message.message_id, `✅ ${esc(t.title)}`);
        }
      } else {
        await answer(cq.id);
      }
    } catch (e) {
      // Telegram повторяет доставку, пока не получит 200, поэтому об ошибке говорим человеку, а не коду ответа.
      console.error(e);
      await answer(cq.id, 'Ошибка, попробуй ещё раз').catch((err: unknown) => console.error(err));
    }
    return new Response('ok');
  }

  const msg = update.message;
  if (!msg?.chat) return new Response('ok');
  const chatId = String(msg.chat.id);
  const text: string = msg.text ?? '';

  // Привязка
  if (text.startsWith('/start')) {
    const code = text.split(' ')[1];
    if (!code) { await send(chatId, 'Это личный бот Ikigai. Подключи его в настройках сайта.'); return new Response('ok'); }
    // Просроченные коды не нужны никому: чистим их при каждой попытке привязки.
    await db.from('bot_links').delete().lt('expires_at', nowISO());
    const { data: l } = await db.from('bot_links').select('*').eq('code', code).maybeSingle();
    if (!l || new Date(l.expires_at) < new Date()) {
      await send(chatId, 'Ссылка устарела. Создай новую в настройках сайта.');
      return new Response('ok');
    }
    // Один чат — один профиль: иначе `profileByChat` наткнётся на две строки и перестанет отвечать.
    const { data: sameChat } = await db.from('rows').select('user_id,id,data')
      .eq('collection', 'profiles').eq('data->>telegramChatId', chatId);
    for (const r of sameChat ?? []) {
      if (r.user_id === l.user_id) continue;
      const { telegramChatId: _unlinked, ...rest } = (r.data as any) ?? {};
      await db.from('rows').update({ data: { ...rest, updatedAt: nowISO() }, updated_at: nowISO() })
        .eq('collection', 'profiles').eq('id', r.id as string).eq('user_id', r.user_id as string);
    }
    const { data: p } = await db.from('rows').select('data').eq('user_id', l.user_id).eq('collection', 'profiles').maybeSingle();
    const profile = {
      ...((p?.data as any) ?? { id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', createdAt: nowISO() }),
      telegramChatId: chatId,
      updatedAt: nowISO(),
    };
    await db.from('rows').upsert({ collection: 'profiles', id: 'me', user_id: l.user_id, data: profile, updated_at: nowISO() });
    await db.from('bot_links').delete().eq('code', code);
    await send(
      chatId,
      '⛩ Подключено. Пиши мне задачи, напоминания, покупки и мысли — я разложу их по местам. Утром в '
        + esc(String(profile.morningTime ?? '09:00')) + ' пришлю сводку.',
    );
    return new Response('ok');
  }

  const link = await profileByChat(chatId);
  if (!link) { await send(chatId, 'Это личный бот.'); return new Response('ok'); }
  const { userId, profile } = link;
  if (!text.trim()) { await send(chatId, 'Пока понимаю только текст.'); return new Response('ok'); }
  const tz = (profile.timezone as string | undefined) ?? 'Asia/Almaty';

  // Исправлением считается только сообщение после кнопки «Изменить»: непрочитанный черновик
  // в статусе `pending` остаётся ждать своего решения, а этот текст станет новым черновиком.
  const { data: editingDraft } = await db.from('bot_drafts')
    .select('*').eq('user_id', userId).eq('status', 'editing')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  /** Правка не удалась: черновик снова просто ждёт решения и не перехватывает следующее сообщение. */
  const releaseDraft = async () => {
    if (!editingDraft) return;
    await db.from('bot_drafts').update({ status: 'pending' })
      .eq('id', editingDraft.id).eq('user_id', userId).eq('status', 'editing');
  };

  if (!(await aiAllowed(userId, tz))) {
    await releaseDraft();
    await saveAsNote(userId, text);
    await send(chatId, 'Лимит ИИ на сегодня исчерпан. Сохранил как заметку во «Входящие».');
    return new Response('ok');
  }

  try {
    const lists = (await rows<any>(userId, 'lists')).map((l: any) => l.title as string);
    const goals = (await rows<any>(userId, 'goals'))
      .filter((g: any) => g.status === 'active')
      .map((g: any) => ({ id: g.id as string, title: g.title as string }));
    const { date, time } = localClock(new Date(), tz);
    const sourceText = editingDraft ? `${editingDraft.source_text ?? ''}\n\nИсправление: ${text}` : text;
    const items = await parseMessage(sourceText, {
      nowLocal: `${date} ${time}`, timezone: tz, lists, goals,
      correction: editingDraft ? text : undefined,
    });
    if (!items.length) {
      await releaseDraft();
      await saveAsNote(userId, text);
      await send(chatId, 'Не понял, что это. Сохранил как заметку во «Входящие».');
      return new Response('ok');
    }
    if (editingDraft) {
      await db.from('bot_drafts').update({ status: 'cancelled' })
        .eq('id', editingDraft.id).eq('user_id', userId);
    }
    const { data: d, error } = await db.from('bot_drafts')
      .insert({ user_id: userId, chat_id: chatId, payload: items, source_text: sourceText })
      .select('id').single();
    if (error || !d) throw error ?? new Error('draft not created');
    await send(chatId, renderDraft(items), [[
      { text: '✅ Сохранить', callback_data: `save:${d.id}` },
      { text: '✏️ Изменить', callback_data: `edit:${d.id}` },
      { text: '✖️ Отмена', callback_data: `cancel:${d.id}` },
    ]]);
  } catch (e) {
    console.error(e);
    await releaseDraft();
    await saveAsNote(userId, text);
    await send(chatId, 'ИИ сейчас недоступен. Сохранил текст как заметку во «Входящие», ничего не потеряно.');
  }
  return new Response('ok');
});
