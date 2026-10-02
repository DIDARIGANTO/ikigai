import { FileText, Lightbulb, ListChecks, Plus, SquarePen } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { NOTE_TEMPLATES } from './templates';
import type { NoteTemplateKey } from './templates';

const ICONS: Record<NoteTemplateKey, typeof FileText> = { blank: FileText, todo: ListChecks, idea: Lightbulb };

/** Пункты общего меню «⋯»: начать заметку с шаблона. */
function templateEntries(onPick: (key: NoteTemplateKey) => void): MenuEntry[] {
  return [
    { type: 'label', label: 'Начать с шаблона' },
    ...NOTE_TEMPLATES.map<MenuEntry>(t => {
      const Icon = ICONS[t.key];
      return { type: 'item', label: t.label, icon: <Icon size={16} />, onSelect: () => onPick(t.key) };
    }),
  ];
}

/**
 * Новая заметка: чистый лист одним нажатием, шаблоны — в общем меню «⋯» рядом.
 * `icon` — тихая кнопка-иконка для шапки колонки заметок (только чистый лист).
 */
export function NewNoteMenu({ onPick, variant = 'button' }: { onPick: (key: NoteTemplateKey) => void; variant?: 'button' | 'icon' }) {
  if (variant === 'icon') {
    return (
      <IconButton size="sm" aria-label="Новая заметка" title="Новая заметка" className="-mr-2" onClick={() => onPick('blank')}>
        <SquarePen size={16} />
      </IconButton>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="primary" onClick={() => onPick('blank')}>
        <Plus size={16} aria-hidden="true" />
        Заметка
      </Button>
      <Menu label="Шаблоны заметки" entries={templateEntries(onPick)} />
    </div>
  );
}
