// deno-lint-ignore-file no-explicit-any
// Тик по расписанию (pg_cron раз в 5 минут): рассылает утреннюю сводку тем,
// у кого в их часовом поясе уже наступило время сводки и сегодня она не уходила.
import { db, rows } from '../_shared/db.ts';
import { send, esc, type Button } from '../_shared/tg.ts';
import { buildMorningDigest, capDigest, shouldSendMorning, localClock, reminderOccursOn } from '../_shared/domain.ts';

const SECRET = Deno.env.get('CRON_SECRET')!;
const SITE = Deno.env.get('SITE_URL') ?? '';
const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dateLabel = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
/** Хвост «не сделано ранее» может копиться месяцами — в сводку берём только начало списка. */
const CARRIED_LIMIT = 10;
/** Запас к лимиту Telegram в 4096 символов: текст ещё экранируется перед отправкой. */
const DIGEST_LIMIT = 3900;

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-cron-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  const now = new Date();
  const { data: profiles } = await db.from('rows').select('user_id,data')
    .eq('collection', 'profiles').not('data->>telegramChatId', 'is', null);
  let sent = 0;
  for (const p of profiles ?? []) {
    const userId = p.user_id as string, profile = p.data as any;
    const tz = (profile.timezone as string | undefined) ?? 'Asia/Almaty';
    const { date: today } = localClock(now, tz);
    // Защита от дублей: попытки за сегодня записаны в sent_digests.
    const { data: rec } = await db.from('sent_digests').select('*')
      .eq('user_id', userId).eq('kind', 'morning').eq('date', today).maybeSingle();
    if (rec?.sent || (rec?.attempts ?? 0) >= 3) continue;
    if (!shouldSendMorning(now, tz, (profile.morningTime as string | undefined) ?? '09:00', null)) continue;

    try {
      const tasks = await rows<any>(userId, 'tasks');
      const reminders = await rows<any>(userId, 'reminders');
      const goals = await rows<any>(userId, 'goals');
      const todays = tasks.filter((t: any) => t.date === today && t.status !== 'skipped' && t.status !== 'done');
      const timed = todays.filter((t: any) => t.plannedStart)
        .sort((a: any, b: any) => String(a.plannedStart).localeCompare(String(b.plannedStart)));
      const untimed = todays.filter((t: any) => !t.plannedStart);
      const carriedAll = tasks.filter((t: any) => t.date && t.date < today && (t.status === 'todo' || t.status === 'doing'));
      const carried = carriedAll.slice(0, CARRIED_LIMIT)
        .map((t: any) => ({ id: t.id as string, title: String(t.title) }));
      if (carriedAll.length > CARRIED_LIMIT) {
        carried.push({ id: 'more', title: `…и ещё ${carriedAll.length - CARRIED_LIMIT}` });
      }
      const wg = goals.find((g: any) => g.id === profile.weekGoalId);
      const wgTasks = tasks.filter((t: any) => t.goalId === wg?.id && t.status !== 'skipped');
      const text = capDigest(buildMorningDigest({
        dateLabel: dateLabel(today),
        weekGoal: wg
          ? { title: wg.title, progress: wgTasks.length ? wgTasks.filter((t: any) => t.status === 'done').length / wgTasks.length : 0 }
          : undefined,
        timed, untimed,
        reminders: reminders.filter((r: any) => reminderOccursOn(r, today))
          .map((r: any) => ({ text: r.text, time: r.time, yearly: r.repeat === 'yearly' })),
        carried,
      }), DIGEST_LIMIT);
      // Текст сводки собран из пользовательских названий, поэтому уходит экранированным целиком.
      const buttons: Button[][] = timed.concat(untimed).slice(0, 8)
        .map((t: any) => [{ text: `▶ ${String(t.title).slice(0, 30)}`, callback_data: `start:${t.id}` }]);
      if (SITE) buttons.push([{ text: 'Открыть Ikigai', url: SITE }]);
      const res = await send(profile.telegramChatId as string, esc(text), buttons);
      if (!res.ok) throw new Error(JSON.stringify(res));
      await db.from('sent_digests').upsert({ user_id: userId, kind: 'morning', date: today, attempts: (rec?.attempts ?? 0) + 1, sent: true });
      sent++;
    } catch (e) {
      console.error(e);
      await db.from('sent_digests').upsert({ user_id: userId, kind: 'morning', date: today, attempts: (rec?.attempts ?? 0) + 1, sent: false });
    }
  }
  return Response.json({ sent });
});
