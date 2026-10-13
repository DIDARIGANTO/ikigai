import { describe, it, expect } from 'vitest';
// Копия доменных помощников для edge-функций зависимостей от Deno не имеет,
// поэтому проверяется тем же прогоном, что и веб-логика (как в `botRender.test.ts`).
import { capDigest, dueReminders, isRunning, nextOccurrence, reminderOccursOn } from '../../../supabase/functions/_shared/domain.ts';

describe('isRunning', () => {
  it('требует и статус doing, и actualStart', () => {
    expect(isRunning({ status: 'doing', actualStart: '2026-09-13T10:00:00Z' })).toBe(true);
    expect(isRunning({ status: 'doing' })).toBe(false);
    expect(isRunning({ status: 'todo', actualStart: '2026-09-13T10:00:00Z' })).toBe(false);
    expect(isRunning({})).toBe(false);
  });
});

describe('capDigest', () => {
  it('не трогает текст в пределах лимита', () => {
    expect(capDigest('раз\nдва', 100)).toBe('раз\nдва');
  });

  it('не выходит за лимит и помечает обрез многоточием', () => {
    const text = Array.from({ length: 50 }, (_, i) => `• задача ${i}`).join('\n');
    const out = capDigest(text, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('\n…')).toBe(true);
  });

  it('режет по границе строки, не обрывая пункт', () => {
    const out = capDigest('первая строка\nвторая строка\nтретья строка', 30);
    expect(out).toBe('первая строка\nвторая строка\n…');
  });

  it('режет по символам, если первая же строка длиннее лимита', () => {
    const out = capDigest('а'.repeat(100), 10);
    expect(out).toBe(`${'а'.repeat(8)}\n…`);
  });
});

describe('reminderOccursOn: по будням (копия для бота)', () => {
  const w = { id: 'w', text: 'x', date: '2026-10-05', repeat: 'weekdays' as const };
  it('срабатывает с понедельника по пятницу и не срабатывает в выходные', () => {
    expect(reminderOccursOn(w, '2026-10-05')).toBe(true); // пн
    expect(reminderOccursOn(w, '2026-10-09')).toBe(true); // пт
    expect(reminderOccursOn(w, '2026-10-10')).toBe(false); // сб
    expect(reminderOccursOn(w, '2026-10-11')).toBe(false); // вс
    expect(reminderOccursOn(w, '2026-10-02')).toBe(false); // до старта
  });
  it('из субботы следующий раз — понедельник', () => {
    expect(nextOccurrence(w, '2026-10-10')).toBe('2026-10-12');
  });
});

describe('dueReminders', () => {
  const rem = (id: string, time: string | undefined, repeat: 'none' | 'daily' | 'weekdays' = 'none', date = '2026-10-05') =>
    ({ id, text: id, date, time, repeat });
  const at = (time: string, date = '2026-10-05') => ({ date, time });
  const ids = (list: { id: string }[]) => list.map(r => r.id);
  const none = new Set<string>();

  it('напоминает в назначенную минуту', () => {
    expect(ids(dueReminders([rem('a', '10:00')], at('10:00'), none))).toEqual(['a']);
  });

  it('не напоминает раньше времени', () => {
    expect(dueReminders([rem('a', '10:00')], at('09:59'), none)).toEqual([]);
  });

  it('молчит про дела без времени: они уходят только в утреннюю сводку', () => {
    expect(dueReminders([rem('a', undefined)], at('10:00'), none)).toEqual([]);
  });

  it('молчит, если сегодня напоминание не срабатывает', () => {
    expect(dueReminders([rem('a', '10:00', 'none', '2026-10-06')], at('10:00'), none)).toEqual([]);
    expect(dueReminders([rem('a', '10:00', 'weekdays')], at('10:00', '2026-10-10'), none)).toEqual([]); // суббота
  });

  it('повторяющиеся срабатывают каждый подходящий день', () => {
    expect(ids(dueReminders([rem('a', '10:00', 'weekdays')], at('10:00', '2026-10-07'), none))).toEqual(['a']);
    expect(ids(dueReminders([rem('d', '10:00', 'daily')], at('10:00', '2026-10-10'), none))).toEqual(['d']);
  });

  it('догоняет пропущенный тик, но через 15 минут уже не поднимает старое', () => {
    expect(ids(dueReminders([rem('a', '10:00')], at('10:15'), none))).toEqual(['a']);
    expect(dueReminders([rem('a', '10:00')], at('10:16'), none)).toEqual([]);
  });

  it('не повторяет уже отправленное', () => {
    expect(dueReminders([rem('a', '10:00'), rem('b', '10:00')], at('10:01'), new Set(['a'])).map(r => r.id)).toEqual(['b']);
  });

  it('несколько сразу — по порядку времени', () => {
    expect(ids(dueReminders([rem('late', '10:05'), rem('early', '10:00')], at('10:06'), none))).toEqual(['early', 'late']);
  });
});
