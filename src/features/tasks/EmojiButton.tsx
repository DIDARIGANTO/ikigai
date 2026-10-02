import { useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { Popover } from '@/components/ui/Popover';

/**
 * Эмодзи рядом с названием: тихая кнопка 32 px без подложки. Пусто — приглушённый значок,
 * выбрано — сам символ. Панель выбора та же, что у общего `EmojiPickerButton`; фокус возвращается на кнопку.
 */
export function EmojiButton({
  value,
  onChange,
  label = 'Эмодзи',
  className = '',
}: {
  value?: string;
  onChange: (emoji: string | undefined) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={value ? `${label}: ${value}. Изменить` : `${label}: выбрать`}
        title={value ? 'Сменить эмодзи' : 'Добавить эмодзи'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`focus-ring press relative inline-flex size-8 shrink-0 items-center justify-center rounded-control leading-none hover:bg-fill aria-expanded:bg-fill pointer-coarse:before:absolute pointer-coarse:before:-inset-1.5 pointer-coarse:before:content-[''] ${
          value ? 'text-lg' : 'text-muted hover:text-text'
        } ${className}`}
      >
        {value ? <span className="font-emoji">{value}</span> : <SmilePlus size={16} aria-hidden="true" />}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="start" role="dialog" label="Выбор эмодзи">
        <EmojiPicker
          value={value}
          onChange={e => {
            onChange(e);
            setOpen(false);
            anchor.current?.focus();
          }}
        />
      </Popover>
    </>
  );
}
