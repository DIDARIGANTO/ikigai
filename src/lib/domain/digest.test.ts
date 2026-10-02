import { describe, it, expect } from 'vitest';
import { buildMorningDigest, shouldSendMorning, localClock } from './digest';

describe('localClock', () => {
  it('returns date and HH:mm in the given timezone', () => {
    expect(localClock(new Date('2026-09-13T03:05:00Z'), 'Asia/Almaty')).toEqual({ date: '2026-09-13', time: '08:05' });
    expect(localClock(new Date('2026-09-12T20:30:00Z'), 'Asia/Almaty')).toEqual({ date: '2026-09-13', time: '01:30' });
  });
});

describe('shouldSendMorning', () => {
  const tz = 'Asia/Almaty';
  it('sends when local time >= morningTime and not sent today', () => {
    expect(shouldSendMorning(new Date('2026-09-13T04:02:00Z'), tz, '09:00', null)).toBe(true);
  });
  it('does not send before morningTime', () => {
    expect(shouldSendMorning(new Date('2026-09-13T03:55:00Z'), tz, '09:00', null)).toBe(false);
  });
  it('does not send twice the same day', () => {
    expect(shouldSendMorning(new Date('2026-09-13T04:02:00Z'), tz, '09:00', '2026-09-13')).toBe(false);
  });
  it('does not send if more than 2 hours late (missed window)', () => {
    expect(shouldSendMorning(new Date('2026-09-13T07:00:00Z'), tz, '09:00', null)).toBe(false);
  });
});

describe('buildMorningDigest', () => {
  it('renders all sections in order', () => {
    const text = buildMorningDigest({
      dateLabel: 'воскресенье, 13 сентября',
      weekGoal: { title: 'Запустить сайт', progress: 0.4 },
      timed: [{ id: 't1', title: 'Тренировка', plannedStart: '07:00', plannedMinutes: 60 }],
      untimed: [{ id: 't2', title: 'Позвонить маме' }],
      reminders: [{ text: 'ДР Асель', yearly: true }],
      carried: [{ id: 't3', title: 'Отчёт' }],
      principle: 'Дисциплина — это свобода',
    });
    expect(text).toContain('☀️ Доброе утро. Сегодня воскресенье, 13 сентября');
    expect(text).toContain('🎯 Цель недели: Запустить сайт — 40%');
    expect(text).toContain('07:00 · Тренировка (60 мин)');
    expect(text).toContain('• Позвонить маме');
    expect(text).toContain('🎂 ДР Асель');
    expect(text).toContain('↩️ Не сделано ранее');
    expect(text).toContain('💡 Дисциплина — это свобода');
  });
  it('omits empty sections', () => {
    const text = buildMorningDigest({ dateLabel: 'x', timed: [], untimed: [], reminders: [], carried: [] });
    expect(text).not.toContain('Цель недели');
    expect(text).toContain('Задач на сегодня нет');
  });
});
