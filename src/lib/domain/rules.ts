import type { Rule, RuleGroup } from '@/lib/types';

/**
 * Правила жизни (Кодекс): чистая логика без интерфейса. Правила собраны в четыре раздела — так, как их назвал владелец:
 * мозг, режим, экономика, спорт.
 */

/** Разделы по порядку, как на странице. */
export const RULE_GROUPS: readonly RuleGroup[] = ['brain', 'regime', 'economy', 'sport'];

export const RULE_GROUP_LABEL: Record<RuleGroup, string> = {
  brain: 'Мозг',
  regime: 'Режим',
  economy: 'Экономика',
  sport: 'Спорт',
};

/** Подсказка в пустом разделе: показывает, какими бывают правила; сама нигде не хранится. */
export const RULE_GROUP_HINT: Record<RuleGroup, string> = {
  brain: 'Например: каждый день читать 20 минут',
  regime: 'Например: подъём в 6:00, отбой до 23:00',
  economy: 'Например: 10% дохода откладывать сразу',
  sport: 'Например: тренировка три раза в неделю',
};

export type GroupedRules = Record<RuleGroup, Rule[]>;

/** По разделам, внутри — в том порядке, в каком правила записаны. Правило с незнакомым разделом не теряется: оно уходит в «Мозг». */
export function groupRules(rules: readonly Rule[]): GroupedRules {
  const out: GroupedRules = { brain: [], regime: [], economy: [], sport: [] };
  for (const r of rules) out[RULE_GROUPS.includes(r.group) ? r.group : 'brain'].push(r);
  for (const g of RULE_GROUPS) out[g].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  return out;
}

/** Перенести в другой раздел, в его конец: возвращает новую строку, исходную не трогает. */
export const moveRule = (rule: Rule, group: RuleGroup, position: number): Rule => ({ ...rule, group, position });
