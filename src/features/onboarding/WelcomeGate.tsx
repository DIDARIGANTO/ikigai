import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMatches, useNavigate } from 'react-router-dom';
import { cloudEnabled, getStore } from '@/data';
import type { Store } from '@/data/store';
import { useFocusTrap, useOverlay } from '@/components/ui/overlay';
import { KEPT_LIST_TITLE } from '@/features/settings/dataOps';
import type { CollectionName, Profile } from '@/lib/types';
import { patchProfile } from './firstPath';
import { countContent, shouldOnboard } from './logic';
import { WelcomeFlow } from './WelcomeFlow';

/** Что считается «своим содержимым» человека. Доски, колонки и папки — каркас, не в счёт. */
const CONTENT: CollectionName[] = ['dreams', 'goals', 'tasks', 'reminders', 'lists', 'listItems', 'notes', 'debts'];

interface Decision {
  show: boolean;
  profile?: Profile;
}

/**
 * Решает один раз на хранилище: показывать ли знакомство. Ждёт, пока каркас подготовит данные
 * (локально — пока появится профиль с демо; в облаке — пока появятся доски), и дальше не
 * передумывает: иначе первая же созданная в знакомстве мечта закрыла бы его на полпути.
 */
async function decide(store: Store): Promise<Decision | null> {
  const profile = (await store.list('profiles'))[0];
  if (!profile) {
    if (!cloudEnabled) return null; // локально каркас вот-вот положит профиль
    if (!(await store.list('boards')).length) return null;
  }
  if (profile?.onboarded) return { show: false };
  type Stamped = { title?: string; createdAt: string; updatedAt: string };
  const lists = (await Promise.all(CONTENT.map(c => store.list(c)))) as Stamped[][];
  const rows = lists.flatMap((rows, i) => (CONTENT[i] === 'lists' ? rows.filter(l => l.title !== KEPT_LIST_TITLE) : rows));
  return { show: shouldOnboard(profile, countContent(profile, rows)), profile };
}

/**
 * Знакомство поверх приложения для нового человека. Не показывается на странице 404
 * (ошибки раздела рисуются вместо рамки страницы, туда ворота не попадают вовсе).
 */
export function WelcomeGate() {
  const matches = useMatches();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [closed, setClosed] = useState(false);
  const notFound = matches.some(m => m.params['*'] !== undefined);

  useEffect(() => {
    let store: Store;
    try {
      store = getStore();
    } catch {
      return;
    }
    let alive = true;
    let decided = false;
    const check = () =>
      decide(store).then(
        d => {
          if (!alive || decided || !d) return;
          decided = true;
          unsub();
          setDecision(d);
        },
        (e: unknown) => console.error('Не удалось проверить знакомство', e),
      );
    const unsub = store.subscribe('*', () => {
      if (!decided) void check();
    });
    void check();
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const open = !!decision?.show && !closed && !notFound;

  const finish = (openToday: boolean) => {
    setClosed(true);
    void patchProfile(getStore(), { onboarded: true });
    if (openToday) navigate('/');
  };

  if (!open) return null;
  return <WelcomeLayer hasDemo={!!decision?.profile?.demoLoaded} name={decision?.profile?.name} onDone={finish} />;
}

function WelcomeLayer({ hasDemo, name, onDone }: { hasDemo: boolean; name?: string; onDone: (openToday: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Esc не закрывает знакомство случайно — для этого есть «Пропустить».
  useOverlay(true, () => {});
  useFocusTrap(ref, true);
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Знакомство с Ikigai"
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-canvas scroll-thin animate-in"
    >
      <WelcomeFlow hasDemo={hasDemo} initialName={name ?? ''} onDone={onDone} />
    </div>,
    document.body,
  );
}
