import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CollectionName, Row } from '@/lib/types';
import { COLLECTIONS } from '@/lib/types';
import { Emitter, type Store, type StoreStatus } from './store';
import { normalizeRows, warnOnce } from './validate';

type Pending = { op: 'put' | 'remove'; collection: CollectionName; id: string; data?: unknown };

const PENDING_PREFIX = 'ikigai.pending.';
/** Ключ до разделения очереди по пользователям: на нём могли остаться чужие операции. */
const LEGACY_PENDING_KEY = 'ikigai.pending';
const FLUSH_INTERVAL = 30000;

export function pendingKey(userId: string) {
  return PENDING_PREFIX + userId;
}

function readPending(userId: string): Pending[] {
  try {
    const raw = JSON.parse(localStorage.getItem(pendingKey(userId)) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as Pending[]) : [];
  } catch {
    // Повреждённая очередь лучше пустой очереди: приложение не должно падать при запуске.
    return [];
  }
}

/**
 * Старая общая очередь не подписана пользователем, поэтому её нельзя приписать
 * текущему аккаунту: переносить такие операции опаснее, чем потерять их.
 */
function dropLegacyPending() {
  try {
    localStorage.removeItem(LEGACY_PENDING_KEY);
  } catch {
    // Приватный режим: чистить нечего.
  }
}

/**
 * Облачное хранилище: одна таблица `rows` (коллекция + id + jsonb).
 *
 * Чтения кешируются в памяти, записи уходят в сеть сразу. Если сети нет,
 * операция попадает в очередь `ikigai.pending.<userId>` в localStorage и
 * повторяется позже — по таймеру, по событию `online` или вручную через `flush()`.
 */
export class SupabaseStore implements Store {
  private cache = new Map<CollectionName, Map<string, unknown>>();
  private loaded = new Set<CollectionName>();
  private em = new Emitter();
  private _status: StoreStatus = 'ok';
  private statusSubs = new Set<(s: StoreStatus) => void>();
  private pending: Pending[];
  private timer: ReturnType<typeof setInterval> | null = null;
  private channel: { unsubscribe: () => void } | null = null;
  private onOnline = () => void this.flush();
  /** Число запросов в полёте: пока оно больше нуля, статус — «сохраняем». */
  private inflight = 0;
  private flushing = false;
  private disposed = false;
  readonly client: SupabaseClient;
  private userId: string;
  private key: string;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
    this.key = pendingKey(userId);
    this.pending = readPending(userId);
    dropLegacyPending();
    this.channel = client
      .channel('rows')
      .on(
        // Тип события задаётся строкой: у клиента нет перегрузки под наш обобщённый вызов.
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'rows', filter: `user_id=eq.${userId}` } as never,
        (payload: { eventType?: string; new?: unknown; old?: unknown }) => {
          const rec = (payload.new ?? payload.old) as { collection: CollectionName; id: string; data?: unknown };
          if (!rec?.collection || !rec.id) return;
          const m = this.map(rec.collection);
          if (payload.eventType === 'DELETE') m.delete(rec.id);
          else m.set(rec.id, rec.data);
          this.em.emit(rec.collection);
        },
      )
      .subscribe();
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL);
    window.addEventListener('online', this.onOnline);
    this.refreshStatus();
  }

  /** Отключает фоновые подписки: вызывается при смене пользователя или выходе. */
  dispose() {
    if (this.disposed) return;
    // Флаг ставим первым: незавершённые запросы не должны после этого трогать
    // очередь — её ключ уже принадлежит «прошлому» пользователю.
    this.disposed = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('online', this.onOnline);
    this.channel?.unsubscribe();
    this.channel = null;
  }

  private map(name: CollectionName) {
    if (!this.cache.has(name)) this.cache.set(name, new Map());
    return this.cache.get(name)!;
  }

  private setStatus(s: StoreStatus) {
    if (this._status === s) return;
    this._status = s;
    this.statusSubs.forEach(cb => cb(s));
  }

  /**
   * Единственное место, где считается статус: иначе параллельные записи гасили
   * бы «сохраняем» друг друга и индикатор мигал бы.
   */
  private refreshStatus() {
    this.setStatus(this.inflight > 0 ? 'saving' : this.pending.length ? 'offline' : 'ok');
  }

  private savePending() {
    if (this.disposed) return;
    try {
      localStorage.setItem(this.key, JSON.stringify(this.pending));
    } catch {
      // Приватный режим: очередь не переживёт перезагрузку, но работу не остановит.
    }
    this.refreshStatus();
  }

  private lastIndexFor(collection: CollectionName, id: string) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (p.collection === collection && p.id === id) return i;
    }
    return -1;
  }

  /**
   * Очередь — только добавление в конец, но повторы схлопываются:
   * put поверх put переписывает старую запись на месте, remove отменяет
   * незавершённые put. Пара remove → put остаётся как есть: это восстановление.
   */
  private enqueue(p: Pending) {
    const last = this.lastIndexFor(p.collection, p.id);
    if (p.op === 'put') {
      if (last >= 0 && this.pending[last].op === 'put') this.pending[last] = p;
      else this.pending.push(p);
      return;
    }
    if (last < 0) {
      this.pending.push(p);
      return;
    }
    this.pending = this.pending.filter(q => !(q.collection === p.collection && q.id === p.id && q.op === 'put'));
    const tail = this.lastIndexFor(p.collection, p.id);
    if (tail < 0 || this.pending[tail].op !== 'remove') this.pending.push(p);
  }

  async list<K extends CollectionName>(name: K): Promise<Row<K>[]> {
    if (!this.loaded.has(name)) {
      const { data, error } = await this.client.from('rows').select('id,data').eq('collection', name);
      if (error) throw error;
      const m = this.map(name);
      for (const r of (data ?? []) as { id: string; data: unknown }[]) m.set(r.id, r.data);
      this.loaded.add(name);
    }
    const { rows, repaired, dropped } = normalizeRows(name, [...this.map(name).values()]);
    warnOnce(name, repaired, dropped, 'облако');
    return rows;
  }

  async put<K extends CollectionName>(name: K, row: Row<K>) {
    this.map(name).set(row.id, row);
    this.em.emit(name);
    await this.exec({ op: 'put', collection: name, id: row.id, data: row });
  }

  /**
   * Пачка строк уходит одним запросом: последовательные `put` дали бы N обращений
   * к сети на импорте или переносе данных.
   */
  async putMany<K extends CollectionName>(name: K, rows: Row<K>[]) {
    if (!rows.length || this.disposed) return;
    const m = this.map(name);
    for (const r of rows) m.set(r.id, r);
    this.em.emit(name);
    this.inflight++;
    this.refreshStatus();
    try {
      const { error } = await this.client.from('rows').upsert(rows.map(r => this.record(name, r.id, r)));
      if (error) throw error;
    } catch {
      if (this.disposed) return;
      for (const r of rows) this.enqueue({ op: 'put', collection: name, id: r.id, data: r });
      this.savePending();
    } finally {
      this.inflight--;
      if (!this.disposed) this.refreshStatus();
    }
  }

  async remove<K extends CollectionName>(name: K, id: string) {
    this.map(name).delete(id);
    this.em.emit(name);
    await this.exec({ op: 'remove', collection: name, id });
  }

  private record(collection: CollectionName, id: string, data: unknown) {
    return { collection, id, user_id: this.userId, data, updated_at: new Date().toISOString() };
  }

  /** Одна операция: сеть сразу, а при неудаче — в конец очереди. Flush отсюда не запускается. */
  private async exec(p: Pending) {
    if (this.disposed) return;
    this.inflight++;
    this.refreshStatus();
    try {
      await this.send(p);
    } catch {
      // Хранилище уже закрыто: ответ пришёл «в пустоту», в чужую очередь его класть нельзя.
      if (this.disposed) return;
      this.enqueue(p);
      this.savePending();
    } finally {
      this.inflight--;
      if (!this.disposed) this.refreshStatus();
    }
  }

  private async send(p: Pending) {
    if (this.disposed) return;
    if (p.op === 'put') {
      const { error } = await this.client.from('rows').upsert(this.record(p.collection, p.id, p.data));
      if (error) throw error;
    } else {
      const { error } = await this.client
        .from('rows')
        .delete()
        .eq('collection', p.collection)
        .eq('id', p.id)
        .eq('user_id', this.userId);
      if (error) throw error;
    }
  }

  /**
   * Повторяет накопленные операции. Первая же неудача останавливает проход:
   * порядок важнее скорости — отправить remove, пропустив упавший перед ним put,
   * значит потерять данные. Непрошедшее возвращается в голову очереди.
   */
  async flush() {
    if (this.disposed || this.flushing || !this.pending.length) return;
    this.flushing = true;
    const queue = this.pending;
    this.pending = [];
    let failed: Pending[] = [];
    try {
      for (let i = 0; i < queue.length; i++) {
        if (this.disposed) return;
        this.inflight++;
        this.refreshStatus();
        try {
          await this.send(queue[i]);
        } catch {
          failed = queue.slice(i);
          break;
        } finally {
          this.inflight--;
        }
      }
      if (this.disposed) return;
      // Впереди всего, что успело встать в очередь за время отправки.
      this.pending = [...failed, ...this.pending];
      this.savePending();
    } finally {
      this.flushing = false;
      if (!this.disposed) this.refreshStatus();
    }
  }

  subscribe(name: CollectionName | '*', cb: () => void) {
    return this.em.on(name, cb);
  }

  /**
   * Сначала сеть, потом кеш: если удаление не прошло, данные должны остаться
   * на экране, а не исчезнуть до перезагрузки страницы.
   */
  async clearAll() {
    if (this.disposed) return;
    this.inflight++;
    this.refreshStatus();
    try {
      const { error } = await this.client.from('rows').delete().eq('user_id', this.userId);
      if (error) throw error;
    } finally {
      this.inflight--;
      if (!this.disposed) this.refreshStatus();
    }
    if (this.disposed) return;
    // Очередь тоже стирается: иначе отложенные записи вернули бы удалённые строки.
    this.pending = [];
    this.savePending();
    for (const c of COLLECTIONS) this.map(c).clear();
    this.em.emit('*');
  }

  status() {
    return this._status;
  }

  onStatus(cb: (s: StoreStatus) => void) {
    this.statusSubs.add(cb);
    return () => {
      this.statusSubs.delete(cb);
    };
  }
}

let client: SupabaseClient | null = null;

/** Клиент Supabase — один на всё приложение. `null`, если облако не настроено. */
export function makeSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}
