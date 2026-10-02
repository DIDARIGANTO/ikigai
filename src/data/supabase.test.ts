import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseStore, pendingKey } from './supabase';

const LEGACY_KEY = 'ikigai.pending';
const KEY = pendingKey('u1');

type Res = { error: Error | null };
type Chain = {
  eq: (col: string, val: string) => Chain;
  then: <A, B>(ok: (v: Res) => A, err?: (e: unknown) => B) => Promise<A | B>;
};

/**
 * Клиент-заглушка: пишет в `sent` порядок отправленных операций, умеет ронять
 * отдельные id (`failIds`) и задерживать ответ (`hold`) — так проверяется
 * поведение при наложении запросов друг на друга.
 */
function fakeClient(mode: 'ok' | 'fail' = 'ok') {
  const ctl = {
    mode,
    upserts: [] as unknown[],
    sent: [] as string[],
    failIds: new Set<string>(),
    hold: null as Promise<void> | null,
  };
  const answer = async (ids: string[]): Promise<Res> => {
    const hold = ctl.hold;
    if (hold) await hold;
    const bad = ctl.mode === 'fail' || ids.some(id => ctl.failIds.has(id));
    return bad ? { error: new Error('нет сети') } : { error: null };
  };
  const client = {
    channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) }),
    from: () => ({
      upsert: (payload: unknown) => {
        ctl.upserts.push(payload);
        const rows = (Array.isArray(payload) ? payload : [payload]) as { id: string }[];
        for (const r of rows) ctl.sent.push(`put:${r.id}`);
        return answer(rows.map(r => r.id));
      },
      // На сервере записей нет: проверяем только кеш и очередь.
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      delete: () => {
        const ids: string[] = [];
        const chain: Chain = {
          eq: (col: string, val: string) => {
            if (col === 'id') {
              ids.push(val);
              ctl.sent.push(`remove:${val}`);
            }
            return chain;
          },
          then: (ok, err) => answer(ids).then(ok, err),
        };
        return chain;
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, ctl, upserts: ctl.upserts };
}

const board = (id: string) => ({ id, title: id, position: 0, createdAt: 'a', updatedAt: 'a' });
const pend = (id: string) => ({ op: 'put', collection: 'boards', id, data: board(id) });

type Entry = { op: string; id: string };
/** Очередь из localStorage в виде «операция:id» — так проще сравнивать порядок. */
function queue(key = KEY): string[] {
  const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as Entry[];
  return raw.map(p => `${p.op}:${p.id}`);
}

function deferred() {
  let release = () => {};
  const promise = new Promise<void>(r => {
    release = r;
  });
  return { promise, release };
}

describe('SupabaseStore — очередь без сети', () => {
  let store: SupabaseStore | null = null;

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    store?.dispose();
    store = null;
  });

  it('складывает неудавшуюся запись в очередь в localStorage', async () => {
    const { client } = fakeClient('fail');
    store = new SupabaseStore(client, 'u1');
    await store.put('boards', board('b1'));

    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toMatchObject([
      { op: 'put', collection: 'boards', id: 'b1' },
    ]);
    expect(store.status()).toBe('offline');
    // Локальный кеш обновился сразу, несмотря на ошибку сети.
    expect((await store.list('boards')).map(b => b.id)).toEqual(['b1']);
  });

  it('пачку строк отправляет одним запросом', async () => {
    const { client, upserts } = fakeClient('ok');
    store = new SupabaseStore(client, 'u1');
    await store.putMany('boards', [board('b1'), board('b2'), board('b3')]);

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toHaveLength(3);
  });

  it('flush отправляет накопленное и чистит очередь', async () => {
    localStorage.setItem(KEY, JSON.stringify([pend('b1')]));
    const { client, upserts } = fakeClient('ok');
    store = new SupabaseStore(client, 'u1');
    expect(store.status()).toBe('offline');

    await store.flush();

    expect(upserts).toHaveLength(1);
    expect(queue()).toEqual([]);
    expect(store.status()).toBe('ok');
  });

  it('держит очередь в ключе своего пользователя', async () => {
    const { client } = fakeClient('fail');
    store = new SupabaseStore(client, 'u1');
    await store.put('boards', board('b1'));
    expect(queue()).toEqual(['put:b1']);
    expect(localStorage.getItem(pendingKey('u2'))).toBeNull();

    // Второй пользователь начинает с пустой очереди и не трогает чужую.
    store.dispose();
    const other = new SupabaseStore(client, 'u2');
    expect(other.status()).toBe('ok');
    await other.put('boards', board('b9'));
    other.dispose();

    expect(queue()).toEqual(['put:b1']);
    expect(queue(pendingKey('u2'))).toEqual(['put:b9']);
  });

  it('стирает старую общую очередь без пользователя', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([pend('b1')]));
    const { client } = fakeClient('ok');
    store = new SupabaseStore(client, 'u1');

    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(store.status()).toBe('ok');
  });

  it('повторный flush во время отправки не запускается', async () => {
    localStorage.setItem(KEY, JSON.stringify([pend('b1')]));
    const { client, ctl } = fakeClient('ok');
    store = new SupabaseStore(client, 'u1');
    const gate = deferred();
    ctl.hold = gate.promise;

    const flushing = store.flush();
    ctl.hold = null;
    // Пока первый flush висит на ответе, в очередь встаёт новая операция.
    ctl.failIds.add('b3');
    await store.put('boards', board('b3'));
    ctl.failIds.clear();

    await store.flush();
    expect(ctl.sent).toEqual(['put:b1', 'put:b3']);

    gate.release();
    await flushing;
    expect(ctl.sent).toEqual(['put:b1', 'put:b3']);
    expect(queue()).toEqual(['put:b3']);
  });

  it('непрошедшее при flush остаётся впереди новых операций', async () => {
    localStorage.setItem(KEY, JSON.stringify([pend('b1'), pend('b2')]));
    const { client, ctl } = fakeClient('ok');
    store = new SupabaseStore(client, 'u1');
    ctl.failIds.add('b1').add('b3');
    const gate = deferred();
    ctl.hold = gate.promise;

    const flushing = store.flush();
    ctl.hold = null;
    await store.put('boards', board('b3'));
    gate.release();
    await flushing;

    expect(queue()).toEqual(['put:b1', 'put:b2', 'put:b3']);
  });

  it('схлопывает повторные put и отменяет put последующим remove', async () => {
    const { client } = fakeClient('fail');
    store = new SupabaseStore(client, 'u1');

    await store.put('boards', board('b1'));
    await store.put('boards', board('b2'));
    await store.put('boards', board('b1'));
    // Второй put встал на место первого, порядок относительно b2 сохранился.
    expect(queue()).toEqual(['put:b1', 'put:b2']);

    await store.remove('boards', 'b1');
    expect(queue()).toEqual(['put:b2', 'remove:b1']);

    // А вот put после remove — это восстановление строки: обе операции нужны.
    await store.put('boards', board('b1'));
    expect(queue()).toEqual(['put:b2', 'remove:b1', 'put:b1']);
  });

  it('после dispose ошибка запроса не возвращается в очередь', async () => {
    const { client, ctl } = fakeClient('fail');
    store = new SupabaseStore(client, 'u1');
    const gate = deferred();
    ctl.hold = gate.promise;

    const writing = store.put('boards', board('b1'));
    store.dispose();
    gate.release();
    await writing;

    expect(localStorage.getItem(KEY)).toBeNull();

    await store.flush();
    await store.put('boards', board('b2'));
    expect(ctl.sent).toEqual(['put:b1']);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('clearAll при ошибке сети сохраняет кеш и пробрасывает ошибку', async () => {
    const { client, ctl } = fakeClient('ok');
    store = new SupabaseStore(client, 'u1');
    await store.put('boards', board('b1'));

    ctl.mode = 'fail';
    await expect(store.clearAll()).rejects.toThrow('нет сети');
    expect((await store.list('boards')).map(b => b.id)).toEqual(['b1']);

    ctl.mode = 'ok';
    await store.clearAll();
    expect(await store.list('boards')).toEqual([]);
  });
});
