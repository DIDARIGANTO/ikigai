import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Brain, Clock, Coins, Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Rule, RuleGroup } from '@/lib/types';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import type { MenuEntry } from '@/components/ui/Menu';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useCollection } from '@/data/hooks';
import { groupRules, moveRule, RULE_GROUP_HINT, RULE_GROUP_LABEL, RULE_GROUPS } from '@/lib/domain/rules';
import { newId, nowISO } from '@/lib/ids';
import { created, deleted, updated, useUndoable } from '@/lib/undo';
import { RuleEditor } from './RuleEditor';
import type { RuleFields } from './RuleEditor';

const FOCUS = 'focus-ring-inset';

const GROUP_ICON: Record<RuleGroup, LucideIcon> = { brain: Brain, regime: Clock, economy: Coins, sport: Dumbbell };

interface RuleActions {
  open: (r: Rule) => void;
  move: (r: Rule, to: RuleGroup) => void;
  remove: (r: Rule) => void;
}

/** Строка правила: номер моноширинным, формулировка и «зачем». Вся строка открывает редактор; перенос в другой раздел — в меню справа. */
function RuleRow({ rule, index, actions }: { rule: Rule; index: number; actions: RuleActions }) {
  const entries: MenuEntry[] = [
    { type: 'item', label: 'Изменить', icon: <Pencil size={14} />, onSelect: () => actions.open(rule) },
    ...RULE_GROUPS.filter(g => g !== rule.group).map<MenuEntry>(g => {
      const Icon = GROUP_ICON[g];
      return { type: 'item', label: `В «${RULE_GROUP_LABEL[g]}»`, icon: <Icon size={14} />, onSelect: () => actions.move(rule, g) };
    }),
    { type: 'separator' },
    { type: 'item', label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: () => actions.remove(rule) },
  ];
  return (
    <li className="group flex items-start border-b border-border pr-2 last:border-b-0 hover:bg-fill focus-within:bg-fill">
      <button
        type="button"
        onClick={() => actions.open(rule)}
        aria-label={`Правило: ${rule.text}`}
        className={`flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 pr-2 text-left ${FOCUS}`}
      >
        <span aria-hidden="true" className="mt-0.5 w-5 shrink-0 text-right font-mono text-small tabular-nums text-muted">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-body text-text">{rule.text}</span>
          {rule.note ? <span className="mt-0.5 block break-words text-small text-muted-strong">{rule.note}</span> : null}
        </span>
      </button>
      <Menu label={`Действия: ${rule.text}`} entries={entries} size="sm" triggerClassName="hover-reveal mt-1.5" />
    </li>
  );
}

/** Раздел: заголовок со значком и числом, правила по порядку или пример, и строка, чтобы записать правило одной строкой. */
function Group({ group, rules, actions, onWrite }: { group: RuleGroup; rules: Rule[]; actions: RuleActions; onWrite: (g: RuleGroup, text: string) => Promise<void> }) {
  const [draft, setDraft] = useState('');
  const Icon = GROUP_ICON[group];
  const label = RULE_GROUP_LABEL[group];
  const id = `rules-${group}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await onWrite(group, text);
  };

  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="mb-2 flex items-center gap-2 label-text text-muted">
        <Icon size={14} aria-hidden="true" />
        {label}
        <span className="font-mono tabular-nums">{rules.length}</span>
      </h2>
      <Card as="div" className="overflow-hidden">
        {rules.length ? (
          <ul>
            {rules.map((r, i) => (
              <RuleRow key={r.id} rule={r} index={i} actions={actions} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-small text-muted">{RULE_GROUP_HINT[group]}</p>
        )}
        <form onSubmit={e => void submit(e)} className="flex items-center gap-2 border-t border-border p-2">
          <Input
            aria-label={`Новое правило: ${label}`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Новое правило и Enter"
            autoComplete="off"
          />
          <IconButton type="submit" size="sm" variant="ghost" aria-label={`Записать правило: ${label}`} disabled={draft.trim() === ''}>
            <Plus size={16} aria-hidden="true" />
          </IconButton>
        </form>
      </Card>
    </section>
  );
}

export function RulesPage() {
  const rules = useCollection('rules');
  const commit = useUndoable();
  const [params, setParams] = useSearchParams();

  const [editor, setEditor] = useState<{ rule: Rule | null } | null>(null);
  const groups = useMemo(() => groupRules(rules), [rules]);

  // Ссылка из поиска: `/rules?rule=<id>` открывает редактор этого правила; редактор выводится из адреса, а не копируется в состояние.
  const wanted = params.get('rule');
  const urlRule = wanted ? (rules.find(r => r.id === wanted) ?? null) : null;
  const current = editor ?? (urlRule ? { rule: urlRule } : null);
  const closeEditor = () => {
    setEditor(null);
    if (wanted) {
      setParams(
        p => {
          p.delete('rule');
          return p;
        },
        { replace: true },
      );
    }
  };

  /** Порядок внутри раздела — по времени записи: новое правило встаёт в конец. */
  const nextPosition = () => Date.now();

  const write = async (group: RuleGroup, text: string) => {
    const now = nowISO();
    await commit('Правило записано', [created('rules', { id: newId(), createdAt: now, updatedAt: now, text, group, position: nextPosition() })]);
  };

  const save = async (fields: RuleFields) => {
    const existing = current?.rule;
    const now = nowISO();
    if (existing) {
      const moved = fields.group !== existing.group;
      await commit('Сохранено', [updated('rules', existing, { ...existing, ...fields, position: moved ? nextPosition() : existing.position })]);
    } else {
      await commit('Правило записано', [created('rules', { id: newId(), createdAt: now, updatedAt: now, position: nextPosition(), ...fields })]);
    }
  };

  const actions: RuleActions = {
    open: r => setEditor({ rule: r }),
    move: (r, to) => void commit(`Перенесено: ${RULE_GROUP_LABEL[to]}`, [updated('rules', r, moveRule(r, to, nextPosition()))]),
    remove: r => void commit('Правило удалено', [deleted('rules', r)]),
  };

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Правила жизни"
        icon={<SectionIcon k="rules" size={20} />}
        description="То, чего ты держишься"
        actions={
          <Button variant="primary" onClick={() => setEditor({ rule: null })}>
            <Plus size={16} aria-hidden="true" />
            Правило
          </Button>
        }
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        {RULE_GROUPS.map(g => (
          <Group key={g} group={g} rules={groups[g]} actions={actions} onWrite={write} />
        ))}
      </div>

      {current ? (
        <RuleEditor
          key={current.rule?.id ?? 'new'}
          rule={current.rule}
          defaultGroup="brain"
          onSave={save}
          onDelete={r => actions.remove(r)}
          onClose={closeEditor}
        />
      ) : null}
    </div>
  );
}
