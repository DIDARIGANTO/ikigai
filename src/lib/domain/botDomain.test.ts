import { describe, it, expect } from 'vitest';
// Копия доменных помощников для edge-функций зависимостей от Deno не имеет,
// поэтому проверяется тем же прогоном, что и веб-логика (как в `botRender.test.ts`).
import { capDigest, isRunning } from '../../../supabase/functions/_shared/domain.ts';

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
