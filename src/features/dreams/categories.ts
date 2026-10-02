import { BookOpen, Briefcase, Dumbbell, House, Plane, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TONES } from '@/components/ui/tones';
import type { Tone } from '@/components/ui/tones';

/**
 * Оформление категории мечты: иконка и тон палитры.
 * `soft` — подложка (шапка карточки, чип), `tone` — цвет иконки и текста чипа, `dot` — точка в фильтре.
 */
export interface CategoryLook {
  icon: LucideIcon;
  /** Имя тона — для плиток и эмодзи. */
  name: Tone;
  soft: string;
  tone: string;
  dot: string;
}

function look(icon: LucideIcon, name: Tone): CategoryLook {
  const t = TONES[name];
  return { icon, name, soft: t.soft, tone: t.strong, dot: t.solid };
}

const LOOKS = {
  work: look(Briefcase, 'indigo'),
  body: look(Dumbbell, 'mint'),
  home: look(House, 'amber'),
  travel: look(Plane, 'sky'),
  mind: look(BookOpen, 'lilac'),
  other: look(Sparkles, 'neutral'),
} satisfies Record<string, CategoryLook>;

/** Названия категорий и близкие к ним слова — пишут по-разному, выглядеть должно одинаково. */
const ALIASES: Record<string, keyof typeof LOOKS> = {
  дело: 'work',
  дела: 'work',
  работа: 'work',
  карьера: 'work',
  бизнес: 'work',
  тело: 'body',
  здоровье: 'body',
  спорт: 'body',
  дом: 'home',
  семья: 'home',
  жильё: 'home',
  жилье: 'home',
  путешествия: 'travel',
  путешествие: 'travel',
  поездки: 'travel',
  разум: 'mind',
  учёба: 'mind',
  учеба: 'mind',
  знания: 'mind',
  книги: 'mind',
};

export function categoryLook(category: string | undefined): CategoryLook {
  const key = category ? ALIASES[category.trim().toLowerCase()] : undefined;
  return LOOKS[key ?? 'other'];
}
