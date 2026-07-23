import type { DecisionOperation } from "./decision-types";
import type { DecisionRule } from "./rule-contract";
import { ruleSupportsOperation } from "./rule-contract";
import {
  getEffectiveRulePriority,
  isRuleActive,
} from "@/lib/creator-enrichment/governance/rules/rule-management";
import {
  cacheRule,
  costRule,
  dnaRule,
  ForceRule,
  FreshnessRule,
  iplRule,
  QueueRule,
} from "./rules";

/**
 * Plug-and-play rule registry — the Decision Engine never instantiates rules directly.
 */
export class DecisionRuleRegistry {
  private readonly rules = new Map<string, DecisionRule>();

  register(rule: DecisionRule): this {
    this.rules.set(rule.id, rule);
    return this;
  }

  registerAll(rules: readonly DecisionRule[]): this {
    for (const rule of rules) {
      this.register(rule);
    }
    return this;
  }

  get(id: string): DecisionRule | undefined {
    return this.rules.get(id);
  }

  /** Rules ordered by priority descending (highest first). Disabled rules excluded. */
  getOrderedRules(operation?: DecisionOperation): DecisionRule[] {
    const rules = operation
      ? [...this.rules.values()].filter((rule) => ruleSupportsOperation(rule, operation))
      : [...this.rules.values()];
    return rules
      .filter((rule) => isRuleActive(rule.id))
      .sort(
        (a, b) =>
          getEffectiveRulePriority(b.id, b.priority) -
          getEffectiveRulePriority(a.id, a.priority)
      );
  }

  get size(): number {
    return this.rules.size;
  }
}

export function createDefaultRuleRegistry(): DecisionRuleRegistry {
  return new DecisionRuleRegistry().registerAll([
    new ForceRule(),
    new QueueRule(),
    new FreshnessRule(),
    iplRule,
    dnaRule,
    cacheRule,
    costRule,
  ]);
}

let defaultRegistry: DecisionRuleRegistry | null = null;

export function getDefaultRuleRegistry(): DecisionRuleRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultRuleRegistry();
  }
  return defaultRegistry;
}

export function resetDefaultRuleRegistryForTests(): void {
  defaultRegistry = null;
}

export function setDefaultRuleRegistryForTests(registry: DecisionRuleRegistry): void {
  defaultRegistry = registry;
}

/** @deprecated Use getDefaultRuleRegistry(). */
export const DEFAULT_DECISION_RULES = createDefaultRuleRegistry().getOrderedRules();
