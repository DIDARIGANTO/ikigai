import { PLAYFUL_TONES, TONES } from '@/components/ui/tones';
import type { Tone } from '@/components/ui/tones';

/**
 * Тона, которые человек выбирает для колонок и списков: нейтральный и девять меток.
 * Хранятся строкой в данных (`Column.tone`, `List.tone`) — всё, чего нет в палитре, считается «не выбран».
 * На экране тон — точка 6 px, а не заливка.
 */
export const PICKABLE_TONES: Tone[] = ['neutral', ...PLAYFUL_TONES];

export const TONE_LABEL: Record<Tone, string> = {
  neutral: 'Без цвета',
  accent: 'Акцент',
  indigo: 'Индиго',
  mint: 'Мята',
  rose: 'Роза',
  amber: 'Янтарь',
  lilac: 'Сирень',
  sky: 'Небо',
  lime: 'Лайм',
  coral: 'Коралл',
  sun: 'Солнце',
  danger: 'Красный',
};

/** Строка из данных → тон палитры; неизвестное значение — `undefined`. */
export function parseTone(value: string | undefined): Tone | undefined {
  return value && Object.hasOwn(TONES, value) ? (value as Tone) : undefined;
}

/**
 * Тон колонки — только выбранный человеком (точка 6 px у названия). По умолчанию колонка нейтральная:
 * смысл колонки несёт значок типа, а не заливка.
 */
export function columnTone(column: { tone?: string }): Tone {
  return parseTone(column.tone) ?? 'neutral';
}

/** Тон списка — тоже только выбранный человеком; без выбора список нейтральный. */
export function listTone(list: { tone?: string }): Tone {
  return parseTone(list.tone) ?? 'neutral';
}
