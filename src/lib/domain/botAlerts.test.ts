import { describe, it, expect } from 'vitest';
// Рассылка напоминаний по времени живёт рядом с edge-функциями (Deno), но зависимостей от Deno не имеет:
// связку с базой и Telegram подставляют снаружи, поэтому её можно проверять тем же прогоном, что и веб-логику.
import { sendDueReminders, MAX_ALERT_ATTEMPTS, type AlertDeps } from '../../../supabase/functions/_shared/alerts.ts';

const rem = (id: string, time: string | undefined, repeat: 'none' | 'daily' | 'weekdays' = 'none', date = '2026-10-05') =>
  ({ id, text: `Дело ${id}`, date, time, repeat });
const NOW = { date: '2026-10-05', time: '10:00' };
const NO_PROGRESS = new Map<string, { attempts: number; sent: boolean }>();

/** Подставные Telegram и база: запоминают, что им отдали. */
function fakes(sendResult: (text: string) => Promise<{ ok: boolean }> = async () => ({ ok: true })) {
  const texts: string[] = [];
  const records: [string, number, boolean][] = [];
  const deps: AlertDeps = {
    send: async text => {
      texts.push(text);
      return sendResult(text);
    },
    record: async (id, attempts, sent) => {
      records.push([id, attempts, sent]);
    },
  };
  return { texts, records, deps };
}

describe('sendDueReminders', () => {
  it('присылает напоминание и записывает, что оно отправлено', async () => {
    const f = fakes();
    const n = await sendDueReminders({ reminders: [rem('a', '10:00')], now: NOW, progress: NO_PROGRESS }, f.deps);
    expect(n).toBe(1);
    expect(f.texts).toEqual(['⏰ Дело a']);
    expect(f.records).toEqual([['a', 1, true]]);
  });

  it('текст приходит экранированным: Telegram разбирает его как HTML', async () => {
    const f = fakes();
    await sendDueReminders({ reminders: [{ ...rem('a', '10:00'), text: 'Позвонить <Асхату>' }], now: NOW, progress: NO_PROGRESS }, f.deps);
    expect(f.texts).toEqual(['⏰ Позвонить &lt;Асхату&gt;']);
  });

  it('ничего не шлёт, если время ещё не пришло или у дела нет времени', async () => {
    const f = fakes();
    const n = await sendDueReminders({ reminders: [rem('a', '10:30'), rem('b', undefined)], now: NOW, progress: NO_PROGRESS }, f.deps);
    expect(n).toBe(0);
    expect(f.texts).toEqual([]);
    expect(f.records).toEqual([]);
  });

  it('уже отправленное сегодня не шлёт второй раз', async () => {
    const f = fakes();
    const progress = new Map([['a', { attempts: 1, sent: true }]]);
    expect(await sendDueReminders({ reminders: [rem('a', '10:00')], now: NOW, progress }, f.deps)).toBe(0);
    expect(f.texts).toEqual([]);
  });

  it('отказ Telegram не считается отправкой: попытка записывается, в следующую минуту повторим', async () => {
    const f = fakes(async () => ({ ok: false }));
    const n = await sendDueReminders({ reminders: [rem('a', '10:00')], now: NOW, progress: new Map([['a', { attempts: 1, sent: false }]]) }, f.deps);
    expect(n).toBe(0);
    expect(f.records).toEqual([['a', 2, false]]);
  });

  it(`после ${MAX_ALERT_ATTEMPTS} неудачных попыток больше не пробует`, async () => {
    const f = fakes();
    const progress = new Map([['a', { attempts: MAX_ALERT_ATTEMPTS, sent: false }]]);
    expect(await sendDueReminders({ reminders: [rem('a', '10:00')], now: NOW, progress }, f.deps)).toBe(0);
    expect(f.texts).toEqual([]);
  });

  it('ошибка при отправке тоже считается попыткой и не мешает остальным', async () => {
    let calls = 0;
    const f = fakes(async () => {
      calls++;
      if (calls === 1) throw new Error('сеть пропала');
      return { ok: true };
    });
    const n = await sendDueReminders({ reminders: [rem('a', '10:00'), rem('b', '10:00')], now: NOW, progress: NO_PROGRESS }, f.deps);
    expect(n).toBe(1);
    expect(f.records).toEqual([['a', 1, false], ['b', 1, true]]);
  });

  it('несколько напоминаний в одну минуту уходят по одному, в порядке времени', async () => {
    const f = fakes();
    const n = await sendDueReminders({ reminders: [rem('b', '10:00'), rem('a', '09:58')], now: NOW, progress: NO_PROGRESS }, f.deps);
    expect(n).toBe(2);
    expect(f.texts).toEqual(['⏰ Дело a', '⏰ Дело b']);
  });
});
