import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, RefreshCw, Trash2, Upload, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { StylePicker } from '@/components/ui/StylePicker';
import { EffectsSwitch } from '@/components/ui/EffectsSwitch';
import { useToast } from '@/components/ui/Toast';
import { cloudEnabled, getStore } from '@/data';
import { exportAll, importAll, downloadText } from '@/data/exportImport';
import { useProfile, useStoreStatus } from '@/data/hooks';
import { formatBytes, useStorageInfo } from '@/data/storage';
import { daysBetween, EXPORT_MAX_AGE_DAYS, readLastExportAt } from '@/data/backup';
import { pluralDays } from '@/features/errors/plural';
import { LocalStore } from '@/data/local';
import { ensureDefaults, loadDemo } from '@/data/seed';
import { todayISO } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { SectionIcon } from '@/components/ui/SectionIcon';
import type { CollectionName } from '@/lib/types';
import { removeDemoData } from './dataOps';

const CURRENCIES = [
  { code: 'KZT', label: 'KZT ₸' },
  { code: 'RUB', label: 'RUB ₽' },
  { code: 'USD', label: 'USD $' },
  { code: 'EUR', label: 'EUR €' },
];

/** Если браузер не умеет отдавать список зон — этого набора хватает для наших широт. */
const FALLBACK_ZONES = [
  'Asia/Almaty', 'Asia/Aqtobe', 'Asia/Bishkek', 'Asia/Tashkent', 'Asia/Dubai', 'Asia/Tbilisi',
  'Europe/Moscow', 'Europe/Kyiv', 'Europe/Istanbul', 'Europe/Berlin', 'Europe/London',
  'America/New_York', 'America/Los_Angeles', 'UTC',
];

function allTimeZones(): string[] {
  try {
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    if (zones.length) return zones;
  } catch {
    // Старый браузер: молча падаем на короткий список.
  }
  return FALLBACK_ZONES;
}

/**
 * Раздел настроек: заголовок 16 px и подпись 13 px над карточкой с линией; строки внутри разделены тонкими линиями.
 * Иконок-плиток и тонированных фонов нет — даже у «Опасной зоны».
 */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 lg:scroll-mt-6">
      <h2 id={`${id}-title`} className="text-h2 font-semibold text-text">
        {title}
      </h2>
      {description ? <p className="mt-0.5 text-small text-muted">{description}</p> : null}
      <Card as="div" className="mt-3 divide-y divide-border">
        {children}
      </Card>
    </section>
  );
}

/** Строка описи: слева — подпись 14 px и пояснение 13 px, справа — чем управляют. */
function Row({
  label,
  hint,
  htmlFor,
  wide = false,
  inline = false,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  /** Поля занимают фиксированную колонку, кнопки — только свою ширину. */
  wide?: boolean;
  /** Маленький элемент (тумблер, статус) остаётся справа и на телефоне. */
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex min-h-14 px-4 py-3 ${
        inline ? 'items-center justify-between gap-4 sm:gap-6' : 'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6'
      }`}
    >
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-body font-medium text-text">
            {label}
          </label>
        ) : (
          <span className="block text-body font-medium text-text">{label}</span>
        )}
        {hint ? <span className="mt-0.5 block text-small text-muted">{hint}</span> : null}
      </div>
      <div className={`flex shrink-0 sm:justify-end ${wide ? 'w-full sm:w-60' : ''}`}>{children}</div>
    </div>
  );
}

/** Стиль: пять образов с живым превью; выбранный применяется сразу. */
function StyleRow() {
  return (
    <div className="px-4 py-4">
      <p className="text-body font-medium text-text">Стиль</p>
      <p className="mt-0.5 text-small text-muted">Цвета, шрифты и углы меняются сразу и запоминаются на этом устройстве</p>
      <StylePicker className="mt-3" />
    </div>
  );
}

/**
 * Защищено ли хранилище браузера от автоматической очистки и когда была последняя копия.
 * Только для локального режима: в облаке данные живут на сервере.
 */
function StorageRow() {
  const info = useStorageInfo();
  const status = useStoreStatus();
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const last = readLastExportAt();
  const lastDays = last === null ? null : daysBetween(last, now);
  const lastText =
    lastDays === null
      ? 'Копии ещё не было.'
      : lastDays === 0
        ? 'Последняя копия — сегодня.'
        : `Последняя копия — ${pluralDays(lastDays)} назад.`;
  const used = info.usageBytes !== null ? ` Занято ${formatBytes(info.usageBytes)}.` : '';

  let value: string;
  let hint: string;
  if (status === 'error') {
    value = 'Не сохраняется';
    hint = `${getStore().errorMessage?.() ?? 'Браузер не даёт хранить данные'}. Всё пропадёт при закрытии вкладки — скачай копию.`;
  } else if (info.persisted) {
    value = 'Защищено';
    hint = `Браузер не удалит данные сам, даже при нехватке места.${used} ${lastText}`;
  } else if (info.supported) {
    value = 'Не защищено';
    hint = `Браузер может стереть их при нехватке места или долгом перерыве.${used} ${lastText}`;
  } else {
    value = 'Без защиты';
    hint = `Этот браузер не умеет защищать данные сайта. Регулярно скачивай копию. ${lastText}`;
  }

  const onRequest = async () => {
    const ok = await info.request();
    if (ok) toast('Хранилище защищено');
    else
      toast('Браузер пока отказал. Он решает сам: помогает установить приложение или чаще заходить сюда', {
        kind: 'error',
      });
  };

  return (
    <Row label={`Хранилище: ${value.toLowerCase()}`} hint={hint}>
      {status !== 'error' && info.supported && info.persisted === false ? (
        <Button onClick={() => void onRequest()}>Запросить защиту</Button>
      ) : (
        <span className={`text-small ${status === 'error' ? 'text-danger-strong' : 'text-muted'}`}>{value}</span>
      )}
    </Row>
  );
}

/** «Как тебя зовут»: имя для приветствия на «Сегодня». Сохраняется, когда поле теряет фокус (или по Enter). */
function NameRow({ name, onSave }: { name?: string; onSave: (name: string | undefined) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState(name ?? '');
  // Имя пришло из хранилища позже первого рендера — подхватываем, пока поле не трогали.
  const [seen, setSeen] = useState(name);
  if (name !== seen) {
    setSeen(name);
    setDraft(name ?? '');
  }
  const commit = () => {
    const value = draft.trim() || undefined;
    if (value === (name ?? undefined)) return;
    onSave(value);
    toast(value ? 'Имя сохранено' : 'Имя убрано');
  };
  const initial = (draft.trim() || name || '').slice(0, 1).toUpperCase();
  return (
    <Row label="Как тебя зовут" hint="Для приветствия на «Сегодня»" htmlFor="set-name" wide>
      <div className="flex w-full items-center gap-2">
        {/* Аватар — нейтральный круг с первой буквой имени. */}
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-mark bg-fill-strong text-body font-medium text-muted-strong"
        >
          {initial || <UserRound size={16} />}
        </span>
        <Input
          id="set-name"
          value={draft}
          autoComplete="given-name"
          placeholder="Имя"
          maxLength={40}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setDraft(name ?? '');
            }
          }}
        />
      </div>
    </Row>
  );
}

/**
 * Экспорт в JSON. Если копии давно не было, пояснение строки само напоминает об этом
 * (вместо отдельной цветной плашки) — с точкой цвета предупреждения.
 */
function ExportRow({ onExport }: { onExport: () => void }) {
  const [now] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const last = readLastExportAt();
  const days = last === null ? null : daysBetween(last, now);
  const stale = !done && (days === null || days > EXPORT_MAX_AGE_DAYS);
  const hint = stale ? (
    <span className="inline-flex items-baseline gap-1.5">
      <span aria-hidden="true" className="size-1.5 shrink-0 -translate-y-px rounded-mark bg-warning" />
      <span>
        Пора сделать копию: {days === null ? 'её ещё не было' : `последней уже ${pluralDays(days)}`}. Один файл сохранит всё,
        если браузер почистит данные.
      </span>
    </span>
  ) : (
    'Один файл со всеми записями — резервная копия'
  );
  return (
    <Row label="Экспорт в JSON" hint={hint}>
      <Button
        onClick={() => {
          onExport();
          setDone(true);
        }}
      >
        <Download size={16} aria-hidden="true" />
        Выгрузить
      </Button>
    </Row>
  );
}

/** Пункты оглавления слева. Облако показывается только в облачном режиме. */
interface NavEntry {
  id: string;
  label: string;
}

/** Ищем прокручиваемый контейнер страницы: на компьютере это `main`, а не окно. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Оглавление: липкая колонка на компьютере, строка вкладок на телефоне.
 * Активный пункт следит за прокруткой; по клику — плавный переход к разделу.
 */
function SectionNav({ entries }: { entries: NavEntry[] }) {
  const [active, setActive] = useState(entries[0]?.id);
  const navRef = useRef<HTMLElement>(null);
  // Пока идёт плавная прокрутка по клику, слежение не перебивает выбранный пункт.
  const locked = useRef(false);
  const unlockTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const root = scrollParent(navRef.current);
    const target: HTMLElement | Window = root ?? window;
    const onScroll = () => {
      if (locked.current) return;
      const top = root ? root.getBoundingClientRect().top : 0;
      const atBottom = root
        ? root.scrollTop + root.clientHeight >= root.scrollHeight - 4
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActive(entries[entries.length - 1]?.id);
        return;
      }
      let current = entries[0]?.id;
      for (const e of entries) {
        const el = document.getElementById(e.id);
        if (el && el.getBoundingClientRect().top - top <= 120) current = e.id;
      }
      setActive(current);
    };
    onScroll();
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      window.clearTimeout(unlockTimer.current);
    };
  }, [entries]);

  const go = (id: string) => {
    setActive(id);
    locked.current = true;
    window.clearTimeout(unlockTimer.current);
    unlockTimer.current = window.setTimeout(() => {
      locked.current = false;
    }, 700);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <nav
      ref={navRef}
      aria-label="Разделы настроек"
      // На телефоне липнет вплотную к шапке: `main` сверху отбит на 16 px, поэтому -top-4.
      className="sticky -top-4 z-10 -mx-4 border-b border-border bg-canvas px-4 pt-3 pb-2 lg:top-6 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0"
    >
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-px lg:overflow-visible">
        {entries.map(({ id, label }) => {
          const on = active === id;
          return (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                aria-current={on ? 'location' : undefined}
                onClick={e => {
                  e.preventDefault();
                  go(id);
                }}
                className={`flex h-8 items-center whitespace-nowrap rounded-control px-2.5 text-body focus-ring ${
                  on ? 'bg-fill-strong text-text' : 'text-muted hover:bg-fill hover:text-text'
                }`}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Клиент облака грузится лениво: в локальном режиме код Supabase не нужен. */
const cloudClient = async () => (await import('@/data/supabase')).makeSupabaseClient();

/** Записи, по которым видно, что в браузере остались несохранённые в облако данные. */
const CONTENT_COLLECTIONS: CollectionName[] = ['tasks', 'goals', 'dreams', 'reminders', 'listItems', 'notes', 'debts'];

async function browserHasData(store: LocalStore): Promise<boolean> {
  for (const c of CONTENT_COLLECTIONS) {
    if ((await store.list(c)).length > 0) return true;
  }
  return false;
}

/** Виден только в облачном режиме: выход из аккаунта и перенос старых браузерных данных. */
function CloudSection() {
  const confirm = useConfirm();
  const toast = useToast();
  const [local] = useState(() => new LocalStore());
  const [hasLocal, setHasLocal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void browserHasData(local).then(v => {
      if (alive) setHasLocal(v);
    });
    return () => {
      alive = false;
    };
  }, [local]);

  const onMigrate = async () => {
    const ok = await confirm(
      'Перенести данные из браузера в облако? После переноса копия в браузере будет очищена.',
      { confirmLabel: 'Перенести', danger: false },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await importAll(getStore(), await exportAll(local));
      await local.clearAll();
      setHasLocal(false);
      toast('Данные перенесены в облако');
    } catch {
      toast('Не удалось перенести данные', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    const ok = await confirm('Выйти из аккаунта? Данные останутся в облаке.', {
      confirmLabel: 'Выйти',
      danger: false,
    });
    if (!ok) return;
    await (await cloudClient())?.auth.signOut();
  };

  return (
    <Section id="settings-cloud" title="Облако" description="Аккаунт и синхронизация между устройствами">
      {hasLocal ? (
        <Row label="Данные из браузера" hint="Записи прошлых запусков до подключения облака">
          <Button disabled={busy} onClick={() => void onMigrate()}>
            Перенести в облако
          </Button>
        </Row>
      ) : null}

      <Row label="Вход" hint="Ссылка для входа придёт на почту заново">
        <Button onClick={() => void onSignOut()}>Выйти</Button>
      </Row>
    </Section>
  );
}

/** Имя бота без «@»: из него собирается ссылка привязки. Задаётся в `.env` (см. docs/SETUP.md). */
const TELEGRAM_BOT = (import.meta.env.VITE_TELEGRAM_BOT ?? '').trim();

const LINK_MINUTES = 15;

/** Кнопка-ссылка: выглядит как обычная кнопка, но открывает Telegram в новой вкладке. */
const LINK_BUTTON =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-border-strong bg-surface px-3 ' +
  'text-body font-medium text-text hover:bg-fill focus-ring press';

/**
 * Привязка Telegram (только в облачном режиме): в `bot_links` кладётся одноразовый код,
 * бот обменивает его на chat id при переходе по ссылке `t.me/<бот>?start=<код>`.
 */
function TelegramSection() {
  const [profile, update] = useProfile();
  const confirm = useConfirm();
  const toast = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connected = !!profile.telegramChatId;
  const deepLink = code ? `https://t.me/${TELEGRAM_BOT}?start=${code}` : '';

  const onConnect = async () => {
    const client = await cloudClient();
    if (!client) return;
    setBusy(true);
    try {
      const { data } = await client.auth.getUser();
      const userId = data.user?.id;
      if (!userId) throw new Error('Нет входа');
      const fresh = newId();
      const expiresAt = new Date(Date.now() + LINK_MINUTES * 60_000).toISOString();
      const { error } = await client.from('bot_links').insert({ code: fresh, user_id: userId, expires_at: expiresAt });
      if (error) throw new Error(error.message);
      setCode(fresh);
    } catch {
      toast('Не удалось создать ссылку', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    const ok = await confirm('Отключить Telegram? Бот перестанет отвечать, утренняя сводка приходить не будет.', {
      confirmLabel: 'Отключить',
    });
    if (!ok) return;
    await update({ telegramChatId: undefined });
    setCode(null);
    toast('Telegram отключён');
  };

  return (
    <Section id="settings-telegram" title="Telegram" description="Бот для быстрых записей и утренней сводки">
      {connected ? (
        <Row label="Подключено" hint="Бот разбирает сообщения и присылает утреннюю сводку">
          <Button variant="danger-quiet" onClick={() => void onDisconnect()}>
            Отключить
          </Button>
        </Row>
      ) : (
        <Row label="Бот" hint="Одноразовая ссылка свяжет бота с этим аккаунтом">
          <Button disabled={busy} onClick={() => void onConnect()}>
            Подключить Telegram
          </Button>
        </Row>
      )}

      {!connected && code ? (
        <div className="px-4 py-3">
          {TELEGRAM_BOT ? (
            <>
              <a className={LINK_BUTTON} href={deepLink} target="_blank" rel="noreferrer">
                Открыть Telegram
              </a>
              <p className="mt-2 text-small text-muted">Ссылка действует 15 минут</p>
              <p className="mt-1 break-all font-mono text-caption text-muted">{deepLink}</p>
            </>
          ) : (
            <p className="text-small text-danger-strong">
              Не задана переменная VITE_TELEGRAM_BOT — без имени бота ссылку не собрать. Код привязки: {code}
            </p>
          )}
        </div>
      ) : null}
    </Section>
  );
}

export function SettingsPage() {
  const [profile, update] = useProfile();
  const confirm = useConfirm();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const nav = useMemo<NavEntry[]>(
    () => [
      { id: 'settings-you', label: 'Ты' },
      { id: 'settings-look', label: 'Внешний вид' },
      { id: 'settings-general', label: 'Время и деньги' },
      { id: 'settings-telegram', label: 'Telegram' },
      { id: 'settings-data', label: 'Данные' },
      ...(cloudEnabled ? [{ id: 'settings-cloud', label: 'Облако' }] : []),
      { id: 'settings-about', label: 'О приложении' },
      { id: 'settings-danger', label: 'Опасная зона' },
    ],
    [],
  );

  // Переход из палитры команд (`/settings#settings-telegram`) — сразу к нужному разделу.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const r = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(r);
  }, [hash]);

  const otherZones = useMemo(() => allTimeZones().filter(z => z !== profile.timezone), [profile.timezone]);

  const onExport = async () => {
    try {
      downloadText(`ikigai-${todayISO()}.json`, await exportAll(getStore()));
      toast('Файл выгружен');
    } catch {
      toast('Не удалось выгрузить данные', { kind: 'error' });
    }
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // тот же файл можно выбрать ещё раз
    if (!file) return;
    const ok = await confirm('Данные из файла добавятся к текущим. Записи с теми же id будут перезаписаны.', {
      confirmLabel: 'Импортировать',
      danger: false,
    });
    if (!ok) return;
    try {
      const { imported, skipped } = await importAll(getStore(), await file.text());
      toast(`Импортировано ${imported} записей${skipped ? `, пропущено ${skipped}` : ''}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось прочитать файл', { kind: 'error' });
    }
  };

  const onRemoveDemo = async () => {
    const ok = await confirm(
      'Удалить демо-данные? Останутся доски с колонками, список «Купить» и папки блокнота.',
    );
    if (!ok) return;
    await removeDemoData(getStore());
    toast('Демо-данные удалены');
  };

  const onRefreshDemo = async () => {
    const ok = await confirm(
      'Обновить демо-данные? Все задачи, цели, мечты, напоминания и заметки (в том числе свои) заменятся свежими примерами с сегодняшними датами.',
      { confirmLabel: 'Обновить' },
    );
    if (!ok) return;
    const store = getStore();
    await removeDemoData(store);
    await loadDemo(store);
    toast('Демо-данные обновлены');
  };

  const onEraseAll = async () => {
    const first = await confirm('Стереть все данные? Вернуть их будет нельзя.', { confirmLabel: 'Стереть' });
    if (!first) return;
    const second = await confirm('Это последнее предупреждение. Сначала стоит выгрузить резервную копию.', {
      confirmLabel: 'Стереть навсегда',
    });
    if (!second) return;
    const store = getStore();
    await store.clearAll();
    await ensureDefaults(store);
    // Профиль записываем заново: без него следующий запуск посчитал бы приложение
    // новым и снова засеял демо-данные. Настройки при этом сохраняются.
    await update({ demoLoaded: false, weekGoalId: undefined });
    toast('Данные стёрты');
  };

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Настройки" icon={<SectionIcon k="settings" size={20} />} description="Профиль, оформление и данные" />

      <div className="mt-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <SectionNav entries={nav} />

        <div className="mt-6 min-w-0 max-w-180 space-y-10 lg:mt-0">
          <Section id="settings-you" title="Ты" description="Как приложение к тебе обращается">
            <NameRow name={profile.name} onSave={name => void update({ name })} />
          </Section>

          <Section id="settings-look" title="Внешний вид" description="Стиль и анимации">
            <StyleRow />
            <Row inline label="Праздничные эффекты" hint="Конфетти при закрытии задачи или цели. По умолчанию выключено">
              <EffectsSwitch />
            </Row>
          </Section>

          <Section id="settings-general" title="Время и деньги" description="Часовой пояс, утренняя сводка и валюта">
            <Row label="Часовой пояс" wide hint="Используется для утренней сводки в Telegram" htmlFor="set-timezone">
              <Select
                id="set-timezone"
                value={profile.timezone}
                onChange={e => void update({ timezone: e.target.value })}
              >
                <optgroup label="Сейчас">
                  <option value={profile.timezone}>{profile.timezone}</option>
                </optgroup>
                <optgroup label="Все">
                  {otherZones.map(z => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Row>

            <Row label="Утренняя сводка" wide hint="Время, когда придёт план на день" htmlFor="set-morning">
              <Input
                id="set-morning"
                type="time"
                className="font-mono tabular-nums"
                value={profile.morningTime}
                onChange={e => {
                  const v = e.target.value;
                  if (v) void update({ morningTime: v });
                }}
              />
            </Row>

            <Row label="Валюта" wide hint="Для цен в списках" htmlFor="set-currency">
              <Select
                id="set-currency"
                value={profile.currency}
                onChange={e => void update({ currency: e.target.value })}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Row>
          </Section>

          {cloudEnabled ? (
            <TelegramSection />
          ) : (
            <Section id="settings-telegram" title="Telegram" description="Бот для быстрых записей и утренней сводки">
              <Row inline label="Бот" hint="Работает после подключения облака — инструкция в docs/SETUP.md">
                <span className="text-small text-muted">Не подключён</span>
              </Row>
            </Section>
          )}

          <Section id="settings-data" title="Данные" description="Резервные копии и примеры">
            {cloudEnabled ? null : <StorageRow />}

            <ExportRow onExport={() => void onExport()} />

            <Row label="Импорт из JSON" hint="Записи из файла добавятся к текущим">
              <Button onClick={() => fileRef.current?.click()}>
                <Upload size={16} aria-hidden="true" />
                Выбрать файл
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={e => void onPickFile(e)}
              />
            </Row>

            <Row label="Обновить демо-данные" hint="Свежие примеры с датами от сегодняшнего дня">
              <Button onClick={() => void onRefreshDemo()}>
                <RefreshCw size={16} aria-hidden="true" />
                Обновить
              </Button>
            </Row>

            {profile.demoLoaded ? (
              <Row label="Демо-данные" hint="Примеры задач, целей и мечт из первого запуска">
                <Button variant="danger-quiet" onClick={() => void onRemoveDemo()}>
                  Удалить демо-данные
                </Button>
              </Row>
            ) : null}
          </Section>

          {cloudEnabled ? <CloudSection /> : null}

          <Section id="settings-about" title="О приложении" description="Версия и где живут данные">
            <Row
              inline
              label="Ikigai"
              hint={
                cloudEnabled
                  ? 'Данные синхронизируются через облако.'
                  : 'Данные хранятся в этом браузере. Облако и бот подключаются отдельно.'
              }
            >
              <span className="text-small text-muted">
                версия <span className="font-mono tabular-nums">0.1</span>
              </span>
            </Row>
          </Section>

          {/* Опасная зона — обычный раздел: без красной рамки и заливки, цвет только у самой кнопки. */}
          <Section id="settings-danger" title="Опасная зона" description="Действия, которые нельзя отменить">
            <Row label="Стереть всё" hint="Останется пустое приложение с досками по умолчанию">
              <Button variant="danger-quiet" onClick={() => void onEraseAll()}>
                <Trash2 size={16} aria-hidden="true" />
                Стереть всё
              </Button>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}
