import {
  ENRICHMENT_STALE_AFTER_DAYS,
  STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS,
} from "@/lib/creator-enrichment/constants";
import {
  getGovernancePolicy,
  resetGovernancePolicyForTests,
  setGovernancePolicyForTests,
} from "@/lib/creator-enrichment/governance/policy/policy-engine";

/** Default rule priority — higher number evaluates first. */
export const DEFAULT_RULE_PRIORITIES = {
  ForceRule: 500,
  QueueRule: 400,
  FreshnessRule: 300,
  IPLRule: 200,
  DNARule: 150,
  CacheRule: 100,
  CostRule: 50,
} as const;

export type DecisionRuleId = keyof typeof DEFAULT_RULE_PRIORITIES;

export type DecisionPolicyConfig = Readonly<{
  /** Days before creator metrics are considered stale. */
  freshnessWindowDays: number;
  /** Queue inflight timeout reference (ms) — mirrors stuck-queue threshold. */
  queueInflightTimeoutMs: number;
  rulePriorities: Readonly<Record<DecisionRuleId, number>>;
}>;

export function getDecisionPolicy(): DecisionPolicyConfig {
  const governance = getGovernancePolicy();
  return Object.freeze({
    freshnessWindowDays: governance.freshnessWindowDays,
    queueInflightTimeoutMs: governance.queueInflightTimeoutMs,
    rulePriorities: governance.rulePriorities,
  });
}

/** Test helper — override policy without touching rules. */
export function setDecisionPolicyForTests(
  overrides: Partial<Omit<DecisionPolicyConfig, "rulePriorities">> & {
    rulePriorities?: Partial<Record<DecisionRuleId, number>>;
  }
): void {
  setGovernancePolicyForTests({
    freshnessWindowDays: overrides.freshnessWindowDays,
    queueInflightTimeoutMs: overrides.queueInflightTimeoutMs,
    rulePriorities: overrides.rulePriorities
      ? Object.freeze({
          ...getGovernancePolicy().rulePriorities,
          ...overrides.rulePriorities,
        })
      : undefined,
  });
}

export function resetDecisionPolicyForTests(): void {
  resetGovernancePolicyForTests();
}

export function getRulePriority(ruleId: DecisionRuleId): number {
  return getDecisionPolicy().rulePriorities[ruleId];
}

/** @deprecated Prefer governance policy constants. */
export const LEGACY_DEFAULT_FRESHNESS_DAYS = ENRICHMENT_STALE_AFTER_DAYS;
/** @deprecated Prefer governance policy constants. */
export const LEGACY_DEFAULT_QUEUE_TIMEOUT_MS = STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS;
