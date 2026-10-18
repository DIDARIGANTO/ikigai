import { useState } from 'react';
import type { Rule, RuleGroup } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { RULE_GROUP_LABEL, RULE_GROUPS } from '@/lib/domain/rules';

/** Поля правила, которые правит редактор; остальное (id, метки времени, порядок) страница сохраняет сама. */
export type RuleFields = Pick<Rule, 'text' | 'group' | 'note'>;

/**
 * Редактор правила: сама формулировка, раздел и «зачем» (по желанию: напоминает, ради чего правило).
 * Формулировка обязательна. «Сохранить» применяет всё, «Отмена» ничего не меняет.
 */
export function RuleEditor({
  rule,
  defaultGroup,
  onSave,
  onDelete,
  onClose,
}: {
  rule: Rule | null;
  defaultGroup: RuleGroup;
  onSave: (fields: RuleFields) => Promise<void> | void;
  onDelete: (rule: Rule) => Promise<void> | void;
  onClose: () => void;
}) {
  const [text, setText] = useState(rule?.text ?? '');
  const [group, setGroup] = useState<RuleGroup>(rule?.group ?? defaultGroup);
  const [note, setNote] = useState(rule?.note ?? '');

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    await onSave({ text: body, group, note: note.trim() || undefined });
    onClose();
  };

  const remove = async () => {
    if (!rule) return;
    onClose();
    await onDelete(rule);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? 'Правило' : 'Новое правило'}
      footer={
        <div className="flex w-full items-center gap-2">
          {rule ? (
            <Button variant="danger-quiet" className="mr-auto -ml-2" onClick={() => void remove()}>
              Удалить
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} className={rule ? '' : 'ml-auto'}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={text.trim() === ''}>
            Сохранить
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <Textarea label="Правило" rows={3} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Как я поступаю всегда" />
        <Select label="Раздел" value={group} onChange={e => setGroup(e.target.value as RuleGroup)}>
          {RULE_GROUPS.map(g => (
            <option key={g} value={g}>
              {RULE_GROUP_LABEL[g]}
            </option>
          ))}
        </Select>
        <Input label="Зачем" value={note} onChange={e => setNote(e.target.value)} placeholder="Ради чего это правило" />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
