import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { CollectionName, Row, Profile } from '@/lib/types';
import { getStore } from './index';
import { nowISO } from '@/lib/ids';
import type { StoreStatus } from './store';

/** Сеть может отвалиться на секунду — столько раз пробуем перечитать коллекцию. */
const LIST_ATTEMPTS = 3;
const LIST_RETRY_MS = 5000;

export function useCollection<K extends CollectionName>(name: K): Row<K>[] {
  const [rows, setRows] = useState<Row<K>[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    let alive = true;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const store = getStore();
    const load = () => {
      // Счётчик отсекает ответы обогнавших друг друга запросов: показываем только последний.
      const mySeq = ++seq.current;
      attempts++;
      store.list(name).then(
        r => {
          if (!alive || mySeq !== seq.current) return;
          attempts = 0;
          setRows(r);
        },
        (e: unknown) => {
          if (!alive || mySeq !== seq.current) return;
          // Прошлые строки остаются на экране: пустой список выглядел бы как потеря данных.
          console.error(`Не удалось загрузить «${name}»`, e);
          if (attempts >= LIST_ATTEMPTS) return;
          retry = setTimeout(load, LIST_RETRY_MS);
        },
      );
    };
    load();
    const unsub = store.subscribe(name, load);
    return () => {
      alive = false;
      if (retry !== null) clearTimeout(retry);
      unsub();
    };
  }, [name]);
  return rows;
}

export const DEFAULT_PROFILE: Profile = {
  id: 'me', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty',
  morningTime: '09:00', currency: 'KZT', createdAt: nowISO(), updatedAt: nowISO(),
};

export function useProfile(): [Profile, (patch: Partial<Profile>) => Promise<void>] {
  const profiles = useCollection('profiles');
  const profile = profiles[0] ?? DEFAULT_PROFILE;
  const update = useCallback(async (patch: Partial<Profile>) => {
    await getStore().put('profiles', { ...profile, ...patch, id: 'me', updatedAt: nowISO() });
  }, [profile]);
  return [profile, update];
}

export function useStoreStatus(): StoreStatus {
  const [s, setS] = useState<StoreStatus>(getStore().status());
  useEffect(() => getStore().onStatus(setS), []);
  return s;
}

/** Универсальные операции записи с автоматическими updatedAt. */
export function useRepo() {
  const store = getStore();
  return useMemo(() => ({
    put: <K extends CollectionName>(name: K, row: Row<K>) => store.put(name, { ...row, updatedAt: nowISO() }),
    remove: <K extends CollectionName>(name: K, id: string) => store.remove(name, id),
  }), [store]);
}
