import type { DecisionRuleId } from "@/lib/creator-enrichment/decision/decision-policy";

export type RuleHealthSnapshot = Readonly<{
  evaluations: number;
  decisiveCount: number;
  noOpinionCount: number;
  avgExecutionMs: number;
  lastEvaluatedAt: string | null;
  lastDecisiveAt: string | null;
  status: "healthy" | "idle" | "degraded";
}>;

export type RuleMetadata = Readonly<{
  id: DecisionRuleId | string;
  version: string;
  description: string;
  dependencies: readonly string[];
  enabled: boolean;
  featureFlag: string | null;
  priorityOverride: number | null;
  health: RuleHealthSnapshot;
}>;

export type RuleManagementSnapshot = Readonly<{
  version: string;
  rules: Readonly<Record<string, RuleMetadata>>;
  enabledCount: number;
  disabledCount: number;
}>;

export type FeatureFlagState = Readonly<Record<string, boolean>>;
