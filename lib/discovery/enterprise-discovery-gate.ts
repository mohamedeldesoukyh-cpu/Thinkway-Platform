import type { DiscoveryCoverageEvaluation } from "@/lib/creators/discovery-coverage";
import type { IntelligenceSufficiencyEvaluation } from "@/lib/discovery/intelligence-sufficiency";

export type EnterpriseDiscoveryGateReason =
  | "low_creator_count"
  | "intelligence_insufficient"
  | "coverage_below_threshold"
  | "sufficient";

export type EnterpriseDiscoveryGateResult = {
  needsBackfill: boolean;
  meetsThreshold: boolean;
  reason: EnterpriseDiscoveryGateReason;
};

export type EnterpriseDiscoveryGateInput = {
  creatorCount: number;
  minimumCreatorCount: number;
  coverageScore: number;
  coverageThreshold: number;
  useIntelligenceGate: boolean;
  intelligence?: IntelligenceSufficiencyEvaluation | null;
};

/**
 * Enterprise Discovery backfill decision.
 * Creator count is the primary signal; coverage score is secondary.
 */
export function evaluateEnterpriseDiscoveryBackfillNeed(
  input: EnterpriseDiscoveryGateInput
): EnterpriseDiscoveryGateResult {
  const {
    creatorCount,
    minimumCreatorCount,
    coverageScore,
    coverageThreshold,
    useIntelligenceGate,
    intelligence,
  } = input;

  if (creatorCount < minimumCreatorCount) {
    return {
      needsBackfill: true,
      meetsThreshold: false,
      reason: "low_creator_count",
    };
  }

  if (useIntelligenceGate && intelligence) {
    if (intelligence.sufficiencyLevel === "insufficient") {
      return {
        needsBackfill: true,
        meetsThreshold: false,
        reason: "intelligence_insufficient",
      };
    }
    return {
      needsBackfill: false,
      meetsThreshold: true,
      reason: "sufficient",
    };
  }

  if (coverageScore < coverageThreshold) {
    return {
      needsBackfill: true,
      meetsThreshold: false,
      reason: "coverage_below_threshold",
    };
  }

  return {
    needsBackfill: false,
    meetsThreshold: true,
    reason: "sufficient",
  };
}

export function buildEnterpriseDiscoveryGateInput(params: {
  creatorCount: number;
  minimumCreatorCount: number;
  coverage: DiscoveryCoverageEvaluation;
  coverageThreshold: number;
  useIntelligenceGate: boolean;
  intelligence?: IntelligenceSufficiencyEvaluation | null;
}): EnterpriseDiscoveryGateInput {
  return {
    creatorCount: params.creatorCount,
    minimumCreatorCount: params.minimumCreatorCount,
    coverageScore: params.coverage.coverageScore,
    coverageThreshold: params.coverageThreshold,
    useIntelligenceGate: params.useIntelligenceGate,
    intelligence: params.intelligence,
  };
}
