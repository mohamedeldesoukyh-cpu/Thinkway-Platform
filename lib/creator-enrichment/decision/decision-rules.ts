/** Backward-compatible re-exports — rules live in ./rules and ./rule-registry. */
export type { DecisionRule } from "./rule-contract";
export {
  ForceRule,
  FreshnessRule,
  QueueRule,
  cacheRule as CacheRule,
  costRule as CostRule,
  dnaRule as DNARule,
  iplRule as IPLRule,
} from "./rules";
export {
  createDefaultRuleRegistry,
  getDefaultRuleRegistry,
  resetDefaultRuleRegistryForTests,
  setDefaultRuleRegistryForTests,
  DecisionRuleRegistry,
} from "./rule-registry";

import { getDefaultRuleRegistry } from "./rule-registry";

/** @deprecated Use getDefaultRuleRegistry().getOrderedRules() */
export const DEFAULT_DECISION_RULES = getDefaultRuleRegistry().getOrderedRules();
