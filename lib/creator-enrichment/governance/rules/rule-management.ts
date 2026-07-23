import type { DecisionRuleId } from "@/lib/creator-enrichment/decision/decision-policy";
import type { RuleEvaluation } from "@/lib/creator-enrichment/decision/decision-types";
import { isDecisiveOpinion } from "@/lib/creator-enrichment/decision/rule-contract";

import type {
  FeatureFlagState,
  RuleHealthSnapshot,
  RuleManagementSnapshot,
  RuleMetadata,
} from "./rule-types";

export const RULE_MANAGEMENT_VERSION = "4.0.0";

const DEFAULT_RULE_DEFINITIONS: ReadonlyArray<
  Readonly<{
    id: DecisionRuleId;
    version: string;
    description: string;
    dependencies: readonly string[];
    featureFlag: string | null;
  }>
> = Object.freeze([
  {
    id: "ForceRule",
    version: "2.4.0",
    description: "Bypasses downstream rules when force refresh is requested.",
    dependencies: [],
    featureFlag: null,
  },
  {
    id: "QueueRule",
    version: "2.4.0",
    description: "Blocks duplicate work when enrichment is already in progress.",
    dependencies: [],
    featureFlag: "rules.queue_rule",
  },
  {
    id: "FreshnessRule",
    version: "4.0.0",
    description: "Skips enrichment when metrics are within policy freshness window.",
    dependencies: ["ForceRule"],
    featureFlag: "rules.freshness_rule",
  },
  {
    id: "IPLRule",
    version: "3.0.0",
    description: "Placeholder — IPL acquisition policy (Phase 3).",
    dependencies: ["FreshnessRule"],
    featureFlag: "rules.ipl_rule",
  },
  {
    id: "DNARule",
    version: "3.0.0",
    description: "Placeholder — Creator DNA completeness policy.",
    dependencies: ["FreshnessRule"],
    featureFlag: "rules.dna_rule",
  },
  {
    id: "CacheRule",
    version: "3.0.0",
    description: "Placeholder — cache reuse policy.",
    dependencies: [],
    featureFlag: "rules.cache_rule",
  },
  {
    id: "CostRule",
    version: "4.0.0",
    description: "Placeholder — cost limit policy.",
    dependencies: ["FreshnessRule"],
    featureFlag: "rules.cost_rule",
  },
]);

function emptyHealth(): RuleHealthSnapshot {
  return Object.freeze({
    evaluations: 0,
    decisiveCount: 0,
    noOpinionCount: 0,
    avgExecutionMs: 0,
    lastEvaluatedAt: null,
    lastDecisiveAt: null,
    status: "idle",
  });
}

function createDefaultRuleMetadata(
  definition: (typeof DEFAULT_RULE_DEFINITIONS)[number]
): RuleMetadata {
  return Object.freeze({
    id: definition.id,
    version: definition.version,
    description: definition.description,
    dependencies: definition.dependencies,
    enabled: true,
    featureFlag: definition.featureFlag,
    priorityOverride: null,
    health: emptyHealth(),
  });
}

const ruleStore = new Map<string, RuleMetadata>(
  DEFAULT_RULE_DEFINITIONS.map((definition) => [
    definition.id,
    createDefaultRuleMetadata(definition),
  ])
);

let featureFlags: FeatureFlagState = Object.freeze({
  "rules.queue_rule": true,
  "rules.freshness_rule": true,
  "rules.ipl_rule": false,
  "rules.dna_rule": false,
  "rules.cache_rule": false,
  "rules.cost_rule": false,
});

function computeHealthStatus(health: RuleHealthSnapshot): RuleHealthSnapshot["status"] {
  if (health.evaluations === 0) return "idle";
  if (health.avgExecutionMs > 50) return "degraded";
  return "healthy";
}

export function getFeatureFlags(): FeatureFlagState {
  return featureFlags;
}

export function setFeatureFlag(flag: string, enabled: boolean): void {
  featureFlags = Object.freeze({ ...featureFlags, [flag]: enabled });
}

export function resetFeatureFlagsForTests(): void {
  featureFlags = Object.freeze({
    "rules.queue_rule": true,
    "rules.freshness_rule": true,
    "rules.ipl_rule": false,
    "rules.dna_rule": false,
    "rules.cache_rule": false,
    "rules.cost_rule": false,
  });
}

export function isRuleFeatureEnabled(rule: RuleMetadata): boolean {
  if (!rule.enabled) return false;
  if (!rule.featureFlag) return true;
  return featureFlags[rule.featureFlag] ?? false;
}

export function getRuleMetadata(ruleId: string): RuleMetadata | undefined {
  return ruleStore.get(ruleId);
}

export function setRuleEnabled(ruleId: string, enabled: boolean): RuleMetadata | undefined {
  const existing = ruleStore.get(ruleId);
  if (!existing) return undefined;
  const updated = Object.freeze({ ...existing, enabled });
  ruleStore.set(ruleId, updated);
  return updated;
}

export function setRulePriorityOverride(
  ruleId: string,
  priorityOverride: number | null
): RuleMetadata | undefined {
  const existing = ruleStore.get(ruleId);
  if (!existing) return undefined;
  const updated = Object.freeze({ ...existing, priorityOverride });
  ruleStore.set(ruleId, updated);
  return updated;
}

export function getEffectiveRulePriority(ruleId: string, defaultPriority: number): number {
  const metadata = ruleStore.get(ruleId);
  if (!metadata?.enabled || !isRuleFeatureEnabled(metadata)) return -1;
  return metadata.priorityOverride ?? defaultPriority;
}

export function isRuleActive(ruleId: string): boolean {
  const metadata = ruleStore.get(ruleId);
  if (!metadata) return true;
  return isRuleFeatureEnabled(metadata);
}

export function recordRuleEvaluationHealth(
  evaluations: readonly RuleEvaluation[]
): void {
  const now = new Date().toISOString();
  for (const evaluation of evaluations) {
    const existing = ruleStore.get(evaluation.ruleId);
    if (!existing) continue;

    const evaluationsCount = existing.health.evaluations + 1;
    const decisiveCount =
      existing.health.decisiveCount + (isDecisiveOpinion(evaluation.opinion) ? 1 : 0);
    const noOpinionCount =
      existing.health.noOpinionCount + (evaluation.opinion === "no_opinion" ? 1 : 0);
    const avgExecutionMs = Math.round(
      (existing.health.avgExecutionMs * existing.health.evaluations +
        evaluation.executionTimeMs) /
        evaluationsCount
    );

    const health = Object.freeze({
      evaluations: evaluationsCount,
      decisiveCount,
      noOpinionCount,
      avgExecutionMs,
      lastEvaluatedAt: now,
      lastDecisiveAt: isDecisiveOpinion(evaluation.opinion)
        ? now
        : existing.health.lastDecisiveAt,
      status: "healthy" as const,
    });

    ruleStore.set(
      evaluation.ruleId,
      Object.freeze({
        ...existing,
        health: Object.freeze({
          ...health,
          status: computeHealthStatus(health),
        }),
      })
    );
  }
}

export function getRuleManagementSnapshot(): RuleManagementSnapshot {
  const rules = Object.freeze(Object.fromEntries(ruleStore.entries()));
  const values = Object.values(rules);
  return Object.freeze({
    version: RULE_MANAGEMENT_VERSION,
    rules,
    enabledCount: values.filter((rule) => isRuleFeatureEnabled(rule)).length,
    disabledCount: values.filter((rule) => !isRuleFeatureEnabled(rule)).length,
  });
}

export function resetRuleManagementForTests(): void {
  ruleStore.clear();
  for (const definition of DEFAULT_RULE_DEFINITIONS) {
    ruleStore.set(definition.id, createDefaultRuleMetadata(definition));
  }
  resetFeatureFlagsForTests();
}

export function validateRuleDependencies(): ReadonlyArray<{
  ruleId: string;
  missingDependencies: readonly string[];
}> {
  const issues: Array<{ ruleId: string; missingDependencies: string[] }> = [];
  for (const rule of ruleStore.values()) {
    const missing = rule.dependencies.filter((dep) => !ruleStore.has(dep));
    if (missing.length > 0) {
      issues.push({ ruleId: rule.id, missingDependencies: missing });
    }
  }
  return Object.freeze(issues);
}
