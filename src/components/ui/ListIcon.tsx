import {
  Book,
  Briefcase,
  Camera,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  Heart,
  House,
  List,
  Music,
  Plane,
  ShoppingBag,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Значки списков из первой версии: старые списки хранят имя lucide-иконки и продолжают так выглядеть. */
const ICONS: Record<string, LucideIcon> = {
  'shopping-bag': ShoppingBag,
  book: Book,
  film: Film,
  gift: Gift,
  plane: Plane,
  dumbbell: Dumbbell,
  home: House,
  car: Car,
  music: Music,
  heart: Heart,
  star: Star,
  briefcase: Briefcase,
  coffee: Coffee,
  camera: Camera,
  'gamepad-2': Gamepad2,
  list: List,
};

/** Новые списки хранят эмодзи в том же поле `icon` с префиксом: `emoji:🎁`. */
const EMOJI_PREFIX = 'emoji:';

// oxlint-disable-next-line react/only-export-components -- кодирование значка живёт рядом с его отрисовкой
export function listEmoji(icon: string | undefined): string | undefined {
  return icon?.startsWith(EMOJI_PREFIX) ? icon.slice(EMOJI_PREFIX.length) || undefined : undefined;
}

// oxlint-disable-next-line react/only-export-components -- кодирование значка живёт рядом с его отрисовкой
export function emojiIcon(emoji: string | undefined): string {
  return emoji ? `${EMOJI_PREFIX}${emoji}` : 'list';
}

/** Значок списка: эмодзи (новые списки) или lucide-иконка (старые). */
export function ListIcon({ name, size = 16, className = '' }: { name?: string; size?: number; className?: string }) {
  const emoji = listEmoji(name);
  if (emoji) {
    return (
      <span aria-hidden="true" className={`font-emoji leading-none ${className}`} style={{ fontSize: size }}>
        {emoji}
      </span>
    );
  }
  const Cmp = (name && ICONS[name]) || List;
  return <Cmp size={size} aria-hidden="true" className={className} />;
}
