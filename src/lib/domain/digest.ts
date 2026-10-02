export interface DigestTask { id: string; title: string; plannedStart?: string; plannedMinutes?: number; }
export interface DigestInput {
  dateLabel: string;
  weekGoal?: { title: string; progress: number };
  timed: DigestTask[];
  untimed: DigestTask[];
  reminders: { text: string; time?: string; yearly?: boolean }[];
  carried: DigestTask[];
  principle?: string;
}

export function buildMorningDigest(i: DigestInput): string {
  const L: string[] = [`☀️ Доброе утро. Сегодня ${i.dateLabel}`, ''];
  if (i.weekGoal) L.push(`🎯 Цель недели: ${i.weekGoal.title} — ${Math.round(i.weekGoal.progress * 100)}%`, '');
  if (i.timed.length + i.untimed.length === 0) L.push('Задач на сегодня нет.', '');
  if (i.timed.length) {
    L.push('🕘 По времени:');
    for (const t of i.timed) L.push(`${t.plannedStart} · ${t.title}${t.plannedMinutes ? ` (${t.plannedMinutes} мин)` : ''}`);
    L.push('');
  }
  if (i.untimed.length) {
    L.push('📋 В течение дня:');
    for (const t of i.untimed) L.push(`• ${t.title}`);
    L.push('');
  }
  if (i.reminders.length) {
    L.push('🔔 Напоминания:');
    for (const r of i.reminders) L.push(`${r.yearly ? '🎂' : '•'} ${r.text}${r.time ? ` в ${r.time}` : ''}`);
    L.push('');
  }
  if (i.carried.length) {
    L.push('↩️ Не сделано ранее:');
    for (const t of i.carried) L.push(`• ${t.title}`);
    L.push('');
  }
  if (i.principle) L.push(`💡 ${i.principle}`);
  return L.join('\n').trim();
}

export function localClock(now: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` };
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Отправлять, если в часовом поясе пользователя уже наступило morningTime (но прошло не больше 2 часов) и сегодня ещё не отправляли. */
export function shouldSendMorning(now: Date, timeZone: string, morningTime: string, lastSentDate: string | null): boolean {
  const { date, time } = localClock(now, timeZone);
  if (lastSentDate === date) return false;
  const diff = toMin(time) - toMin(morningTime);
  return diff >= 0 && diff <= 120;
}
