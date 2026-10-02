import { describe, expect, it } from 'vitest';
import type { SearchHit } from './search';
import { COMMANDS, pushRecent, rankCommands, readRecent, RECENT_KEY, scoreCommand, writeRecent } from './commands';

const ids = (q: string, limit?: number) => rankCommands(q, COMMANDS, limit).map(c => c.id);

describe('scoreCommand', () => {
  it('начало названия важнее начала слова, подстроки и синонима', () => {
    const cmd = { label: 'Новая задача', keywords: ['создать'] };
    expect(scoreCommand('нов', cmd)).toBe(100);
    expect(scoreCommand('зад', cmd)).toBe(80);
    expect(scoreCommand('адач', cmd)).toBe(60);
    expect(scoreCommand('созд', cmd)).toBe(50);
    expect(scoreCommand('xyz', cmd)).toBe(0);
  });

  it('раздел после «Перейти:» считается началом', () => {
    expect(scoreCommand('кале', { label: 'Перейти: Календарь' })).toBe(100);
  });

  it('буквы по порядку находят с небольшим весом', () => {
    const s = scoreCommand('нвз', { label: 'Новая задача' });
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(40);
  });

  it('е и ё не различаются, регистр не важен', () => {
    expect(scoreCommand('ТЕМН', { label: 'Сменить стиль', keywords: ['тёмная'] })).toBe(50);
  });
});

describe('rankCommands', () => {
  it('пустой запрос — предложенные команды, «Новая задача» первой', () => {
    const list = ids('');
    expect(list[0]).toBe('quick');
    expect(list).toContain('style');
    expect(list).toContain('export');
    expect(list.length).toBeLessThanOrEqual(6);
  });

  it('ранжирует по весу', () => {
    expect(ids('с')[0]).toBe('go:today'); // «Сегодня» начинается с «с», раньше «Списков» по порядку
    expect(ids('спис')[0]).toBe('go:lists');
    expect(ids('заметки')).toEqual(['go:notes']);
    expect(ids('телег')[0]).toBe('telegram');
    expect(ids('json')).toEqual(['export']);
    expect(ids('стиль')[0]).toBe('style');
    expect(ids('тема')[0]).toBe('style');
  });

  it('все разделы из задачи доступны командами', () => {
    for (const label of ['Сегодня', 'Календарь', 'Доски', 'Цели', 'Мечты', 'Напоминания', 'Списки', 'Блокнот', 'Долги', 'Входящие', 'Моя жизнь', 'Настройки']) {
      expect(COMMANDS.some(c => c.label === `Перейти: ${label}`)).toBe(true);
    }
  });
});

describe('недавнее', () => {
  const hit = (n: number): SearchHit => ({ key: `note:${n}`, kind: 'note', id: String(n), title: `Заметка ${n}`, to: `/notes?note=${n}` });

  it('новое — в начало, без повторов, не больше пяти', () => {
    let list: SearchHit[] = [];
    for (let i = 1; i <= 7; i++) list = pushRecent(list, hit(i));
    expect(list.map(h => h.id)).toEqual(['7', '6', '5', '4', '3']);
    list = pushRecent(list, hit(5));
    expect(list.map(h => h.id)).toEqual(['5', '7', '6', '4', '3']);
  });

  it('читает и пишет через хранилище, мусор отбрасывает', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    writeRecent([hit(1)], storage);
    expect(readRecent(storage).map(h => h.id)).toEqual(['1']);
    mem.set(RECENT_KEY, JSON.stringify([{ nope: 1 }, hit(2)]));
    expect(readRecent(storage).map(h => h.id)).toEqual(['2']);
    mem.set(RECENT_KEY, '{broken');
    expect(readRecent(storage)).toEqual([]);
  });
});

describe('нечёткое совпадение без шума', () => {
  it('две буквы не ловят команды случайно', () => {
    expect(ids('ид')).toEqual([]);
  });
  it('буквы по порядку — только от начала слова', () => {
    expect(ids('нвз')).toEqual(['quick']);
    expect(ids('кдр')).toEqual(['go:calendar']);
    expect(ids('врт')).toEqual([]);
  });
});
