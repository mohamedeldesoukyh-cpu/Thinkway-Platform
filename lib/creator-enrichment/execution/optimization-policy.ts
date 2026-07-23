import { ENRICHMENT_STALE_AFTER_DAYS } from "@/lib/creator-enrichment/constants";
import { getGovernancePolicy } from "@/lib/creator-enrichment/governance/policy/policy-engine";

/** Estimated Apify credit units per live profile fetch (planning only). */
export const DEFAULT_APIFY_CREDITS_PER_PROFILE = 1;

/** Estimated AI processing units per DNA bridge when run (planning only). */
export const DEFAULT_AI_UNITS_PER_DNA_BRIDGE = 0.1;

export type StageCostEstimates = Readonly<{
  apifyCredits: number;
  aiProcessingUnits: number;
  externalApiCalls: number;
}>;

export type StageDurationEstimatesMs = Readonly<{
  metrics: number;
  ipl: number;
  creatorDna: number;
  avatar: number;
  audience: number;
  platformMetadata: number;
  aiAnalysis: number;
}>;

export type OptimizationPolicyConfig = Readonly<{
  freshnessWindowDays: number;
  iplValidityDays: number;
  dnaCompletenessThreshold: number;
  avatarValidityDays: number;
  audienceValidityDays: number;
  stageCosts: Readonly<{
    iplRun: StageCostEstimates;
    metricsRun: StageCostEstimates;
    dnaRun: StageCostEstimates;
    avatarRun: StageCostEstimates;
    audienceRun: StageCostEstimates;
    platformMetadataRun: StageCostEstimates;
    aiAnalysisRun: StageCostEstimates;
  }>;
  stageDurationsMs: StageDurationEstimatesMs;
}>;

const defaultStageCosts = {
  iplRun: { apifyCredits: 1, aiProcessingUnits: 0, externalApiCalls: 1 },
  metricsRun: { apifyCredits: 0, aiProcessingUnits: 0, externalApiCalls: 0 },
  dnaRun: { apifyCredits: 0, aiProcessingUnits: 0.1, externalApiCalls: 0 },
  avatarRun: { apifyCredits: 0, aiProcessingUnits: 0, externalApiCalls: 0 },
  audienceRun: { apifyCredits: 0, aiProcessingUnits: 0, externalApiCalls: 0 },
  platformMetadataRun: { apifyCredits: 0, aiProcessingUnits: 0, externalApiCalls: 0 },
  aiAnalysisRun: { apifyCredits: 0, aiProcessingUnits: 0, externalApiCalls: 0 },
} as const;

const defaultStageDurationsMs: StageDurationEstimatesMs = {
  metrics: 2_000,
  ipl: 8_000,
  creatorDna: 1_500,
  avatar: 1_000,
  audience: 500,
  platformMetadata: 300,
  aiAnalysis: 0,
};

let optimizationPolicy: OptimizationPolicyConfig = Object.freeze({
  freshnessWindowDays: ENRICHMENT_STALE_AFTER_DAYS,
  iplValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
  dnaCompletenessThreshold: 70,
  avatarValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
  audienceValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
  stageCosts: defaultStageCosts,
  stageDurationsMs: defaultStageDurationsMs,
});

export function getOptimizationPolicy(): OptimizationPolicyConfig {
  const governance = getGovernancePolicy();
  return Object.freeze({
    ...optimizationPolicy,
    freshnessWindowDays: governance.freshnessWindowDays,
    iplValidityDays: governance.iplValidityDays,
    dnaCompletenessThreshold: governance.dnaCompletenessThreshold,
    avatarValidityDays: governance.avatarValidityDays,
    audienceValidityDays: governance.audienceValidityDays,
  });
}

export function setOptimizationPolicyForTests(
  overrides: Partial<OptimizationPolicyConfig>
): void {
  optimizationPolicy = Object.freeze({
    ...optimizationPolicy,
    ...overrides,
    stageCosts: Object.freeze({
      ...optimizationPolicy.stageCosts,
      ...(overrides.stageCosts ?? {}),
    }),
    stageDurationsMs: Object.freeze({
      ...optimizationPolicy.stageDurationsMs,
      ...(overrides.stageDurationsMs ?? {}),
    }),
  });
}

export function resetOptimizationPolicyForTests(): void {
  optimizationPolicy = Object.freeze({
    freshnessWindowDays: ENRICHMENT_STALE_AFTER_DAYS,
    iplValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
    dnaCompletenessThreshold: 70,
    avatarValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
    audienceValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
    stageCosts: defaultStageCosts,
    stageDurationsMs: defaultStageDurationsMs,
  });
}

export function isWithinDays(isoTimestamp: string | null, days: number, now = Date.now()): boolean {
  if (!isoTimestamp) return false;
  const ts = Date.parse(isoTimestamp);
  if (Number.isNaN(ts)) return false;
  return now - ts < days * 24 * 60 * 60 * 1000;
}
