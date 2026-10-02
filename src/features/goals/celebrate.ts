import type { GoalStatus } from '@/lib/types';

/** Цели, которые уже праздновали на этом устройстве: праздник — один раз на цель. */
export const CELEBRATED_KEY = 'ikigai.goals.celebrated';

export function readCelebrated(): Set<string> {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markCelebrated(id: string): void {
  const set = readCelebrated();
  set.add(id);
  try {
    localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...set]));
  } catch {
    /* приватный режим — отпразднуем ещё раз, не беда */
  }
}

/**
 * Праздновать ли: цель дошла до 100 % по шагам и подцелям, ещё активна
 * (достигнутую вручную не поздравляем повторно) и праздника у неё ещё не было.
 */
export function shouldCelebrate({
  id,
  progress,
  status,
  celebrated,
}: {
  id: string;
  progress: number;
  status: GoalStatus;
  celebrated: Set<string>;
}): boolean {
  return status === 'active' && progress >= 1 && !celebrated.has(id);
}
