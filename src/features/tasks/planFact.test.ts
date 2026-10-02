import { describe, it, expect } from 'vitest';
import { planFactBar } from './planFact';

describe('planFactBar', () => {
  it('в пределах плана', () => {
    expect(planFactBar(60, 30)).toEqual({ fill: 0.5, over: false, short: '30/60 мин', title: 'план 60 мин · факт 30 мин' });
  });
  it('перерасход', () => {
    const r = planFactBar(30, 42);
    expect(r).toMatchObject({ fill: 1, over: true, short: '+12 мин' });
    expect(r.title).toContain('на 12 мин дольше');
  });
  it('ровно по плану — не перерасход', () => {
    expect(planFactBar(30, 30)).toMatchObject({ fill: 1, over: false });
  });
  it('отрицательный факт и нулевой план не ломают полосу', () => {
    expect(planFactBar(0, -5)).toMatchObject({ fill: 0, over: false });
  });
});
