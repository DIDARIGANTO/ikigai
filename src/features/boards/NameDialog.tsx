import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** Диалог с одним полем: новая доска, переименование доски или колонки. */
export function NameDialog({
  title,
  label,
  placeholder,
  initial = '',
  submitLabel = 'Сохранить',
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  placeholder?: string;
  initial?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();

  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit} disabled={!trimmed}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          label={label}
          autoFocus
          value={value}
          placeholder={placeholder}
          maxLength={60}
          onChange={e => setValue(e.target.value)}
        />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          {submitLabel}
        </button>
      </form>
    </Modal>
  );
}
