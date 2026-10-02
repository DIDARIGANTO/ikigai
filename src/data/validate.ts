import type { CollectionName, Row } from '@/lib/types';

/**
 * Проверка строк на границе хранилища. Всё, что читается из IndexedDB, облака
 * или файла импорта, проходит через `normalizeRow`: интерфейс видит только строки
 * правильной формы. Что можно безопасно починить — чиним (значения по умолчанию
 * для перечислений, выброс неверных необязательных полей), что нельзя — отбрасываем.
 * Незнакомые поля сохраняются: их могла записать более новая версия приложения.
 */

type Rec = Record<string, unknown>;

/** Правило одного поля. Возвращает `ok` (как есть), `fix` (новое значение / удалить поле) или `drop`. */
type Check = (v: unknown) => { ok: true } | { fix: unknown } | { drop: true };

const OK = { ok: true } as const;
const DROP = { drop: true } as const;
/** Удалить поле: у необязательных полей неверное значение хуже, чем никакое. */
const REMOVE = { fix: undefined };

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateISO(v: unknown): v is string {
  if (!isStr(v)) return false;
  const m = DATE_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export const isTimeHM = (v: unknown): v is string => isStr(v) && TIME_RE.test(v);
const isInstant = (v: unknown): v is string => isStr(v) && v !== '' && Number.isFinite(Date.parse(v));

// ——— Правила полей ———

/** Обязательная строка: число превращаем в текст, иначе ставим запасное значение. */
const text = (fallback = ''): Check => v => (isStr(v) ? OK : isNum(v) ? { fix: String(v) } : { fix: fallback });
/** Обязательная строка без разумного запасного значения (например, ссылка на родителя). */
const ref: Check = v => (isStr(v) && v !== '' ? OK : DROP);
const optText: Check = v => (v === undefined || isStr(v) ? OK : isNum(v) ? { fix: String(v) } : REMOVE);
/** Необязательная ссылка на другую запись: пустая строка равна отсутствию ссылки. */
const optRef: Check = v => (v === undefined || (isStr(v) && v !== '') ? OK : REMOVE);
const oneOf = <T extends string>(values: readonly T[], fallback: T): Check => v =>
  (values as readonly unknown[]).includes(v) ? OK : { fix: fallback };
const optDate: Check = v => (v === undefined || isDateISO(v) ? OK : REMOVE);
const reqDate: Check = v => (isDateISO(v) ? OK : DROP);
const optTime: Check = v => (v === undefined || isTimeHM(v) ? OK : REMOVE);
const reqTime = (fallback: string): Check => v => (isTimeHM(v) ? OK : { fix: fallback });
const optInstant: Check = v => (v === undefined || isInstant(v) ? OK : REMOVE);
const num = (fallback = 0): Check => v => (isNum(v) ? OK : { fix: fallback });
const optNum: Check = v => (v === undefined || isNum(v) ? OK : REMOVE);
const optNonNeg: Check = v => (v === undefined || (isNum(v) && v >= 0) ? OK : REMOVE);
const bool = (fallback = false): Check => v => (typeof v === 'boolean' ? OK : { fix: fallback });
const optBool: Check = v => (v === undefined || typeof v === 'boolean' ? OK : REMOVE);
/** Сумма долга: неотрицательное число; всё остальное — 0 (такой долг считается закрытым). */
const money: Check = v => (isNum(v) && v >= 0 ? OK : { fix: 0 });
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Возвраты по долгу: негодные записи отбрасываем, остальные оставляем как есть; нет списка — пустой. */
const payments: Check = v => {
  if (!Array.isArray(v)) return { fix: [] };
  const good = v.filter(p => isRec(p) && isStr(p.id) && p.id !== '' && isNum(p.amount) && p.amount > 0 && isDateISO(p.date));
  return good.length === v.length ? OK : { fix: good };
};

function validTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validCurrency(c: string) {
  try {
    new Intl.NumberFormat('ru', { style: 'currency', currency: c });
    return true;
  } catch {
    return false;
  }
}

const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty';
  } catch {
    return 'Asia/Almaty';
  }
};

/** Часовой пояс и валюта уходят в `Intl`: неверное значение бросило бы исключение при отрисовке. */
const timeZone: Check = v => (isStr(v) && validTimeZone(v) ? OK : { fix: localZone() });
const currency: Check = v => (isStr(v) && validCurrency(v) ? OK : { fix: 'KZT' });

const SOURCE = ['web', 'telegram'] as const;
const EPOCH = '1970-01-01T00:00:00.000Z';

type Spec = Record<string, Check>;

const SPECS: Record<CollectionName, Spec> = {
  profiles: {
    timezone: timeZone,
    morningTime: reqTime('09:00'),
    currency,
    telegramChatId: optText,
    weekGoalId: optRef,
    demoLoaded: optBool,
  },
  dreams: {
    title: text(),
    description: optText,
    imageDataUrl: optText,
    category: optText,
    doneAt: optInstant,
    goalId: optRef,
    emoji: optText,
  },
  goals: {
    title: text(),
    description: optText,
    horizon: oneOf(['years', 'year', 'month', 'week'], 'month'),
    parentId: optRef,
    dreamId: optRef,
    startDate: optDate,
    endDate: optDate,
    status: oneOf(['active', 'done', 'dropped'], 'active'),
    emoji: optText,
  },
  boards: { title: text(), position: num() },
  columns: {
    boardId: ref,
    title: text(),
    kind: oneOf(['todo', 'doing', 'done'], 'todo'),
    position: num(),
  },
  tasks: {
    title: text(),
    notes: optText,
    area: oneOf(['work', 'personal'], 'personal'),
    boardId: optRef,
    columnId: optRef,
    goalId: optRef,
    date: optDate,
    plannedStart: optTime,
    plannedMinutes: optNonNeg,
    actualStart: optInstant,
    actualEnd: optInstant,
    status: oneOf(['todo', 'doing', 'done', 'skipped'], 'todo'),
    important: optBool,
    rescheduleCount: num(),
    source: oneOf(SOURCE, 'web'),
    kind: oneOf(['task', 'workout'], 'task'),
    position: num(),
    emoji: optText,
  },
  reminders: {
    text: text(),
    date: reqDate,
    time: optTime,
    repeat: oneOf(['none', 'daily', 'weekly', 'monthly', 'yearly'], 'none'),
  },
  lists: { title: text(), icon: text('list'), position: num(), pinned: bool(), emoji: optText },
  listItems: {
    listId: ref,
    text: text(),
    note: optText,
    url: optText,
    price: optNum,
    doneAt: optInstant,
    position: num(),
  },
  noteFolders: { title: text(), position: num() },
  notes: { folderId: optRef, title: text(), body: text(), source: oneOf(SOURCE, 'web') },
  dailyLogs: {
    date: reqDate,
    energy: v => (v === undefined || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5) ? OK : REMOVE),
    done: num(),
    skipped: num(),
    moved: num(),
    accuracy: optNonNeg,
    focusMinutes: num(),
    goalMinutes: num(),
    closedAt: v => (isInstant(v) ? OK : { fix: EPOCH }),
  },
  debts: {
    direction: oneOf(['owedToMe', 'iOwe'], 'owedToMe'),
    person: text(),
    amount: money,
    currency,
    date: reqDate,
    dueDate: optDate,
    note: optText,
    payments,
    closedAt: optInstant,
  },
};


export type Normalized<K extends CollectionName> = { row: Row<K>; repaired: boolean } | null;

/**
 * Проверяет и чинит одну строку. `null` — строку нельзя показывать (нет `id`,
 * не объект, нет обязательной ссылки или даты). Если чинить нечего, возвращает
 * тот же объект — без копирования.
 */
export function checkRow<K extends CollectionName>(collection: K, raw: unknown): Normalized<K> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const src = raw as Rec;
  if (!isStr(src.id) || src.id === '') return null;
  const spec = SPECS[collection];
  if (!spec) return null;

  let out: Rec | null = null;
  const set = (k: string, v: unknown) => {
    out ??= { ...src };
    if (v === undefined) delete out[k];
    else out[k] = v;
  };

  // Метки времени: без них не работает сортировка, но строку это не портит.
  const created = isStr(src.createdAt) ? src.createdAt : isStr(src.updatedAt) ? src.updatedAt : EPOCH;
  if (src.createdAt !== created) set('createdAt', created);
  if (!isStr(src.updatedAt)) set('updatedAt', created);

  for (const [field, check] of Object.entries(spec)) {
    const r = check(src[field]);
    if ('drop' in r) return null;
    if ('fix' in r) {
      // Отсутствующее необязательное поле и так отсутствует: это не починка.
      if (r.fix === undefined && !(field in src)) continue;
      set(field, r.fix);
    }
  }
  return { row: (out ?? src) as unknown as Row<K>, repaired: out !== null };
}

/** Починенная строка или `null`, если её нельзя показывать. */
export function normalizeRow<K extends CollectionName>(collection: K, raw: unknown): Row<K> | null {
  return checkRow(collection, raw)?.row ?? null;
}

export interface NormalizeReport<K extends CollectionName> {
  rows: Row<K>[];
  repaired: number;
  dropped: number;
}

export function normalizeRows<K extends CollectionName>(collection: K, raws: readonly unknown[]): NormalizeReport<K> {
  const rows: Row<K>[] = [];
  let repaired = 0;
  let dropped = 0;
  for (const raw of raws) {
    const r = checkRow(collection, raw);
    if (!r) {
      dropped++;
      continue;
    }
    if (r.repaired) repaired++;
    rows.push(r.row);
  }
  return { rows, repaired, dropped };
}

/** Последнее предупреждение по коллекции: одинаковое повторять при каждом перечитывании незачем. */
const warned = new Map<string, string>();

/** Одно `console.warn` на коллекцию — и только когда счётчики изменились. */
export function warnOnce(collection: CollectionName, repaired: number, dropped: number, where = 'хранилище') {
  if (!repaired && !dropped) return;
  const key = `${where}:${collection}`;
  const sig = `${repaired}/${dropped}`;
  if (warned.get(key) === sig) return;
  warned.set(key, sig);
  console.warn(`Ikigai: ${where}, «${collection}»: исправлено ${repaired}, скрыто ${dropped} повреждённых записей`);
}

/** Для тестов: забыть, о чём уже предупреждали. */
export function resetWarnings() {
  warned.clear();
}
