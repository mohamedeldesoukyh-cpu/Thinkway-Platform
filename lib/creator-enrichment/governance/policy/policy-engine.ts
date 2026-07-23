import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";
import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

import { DEFAULT_GOVERNANCE_POLICY, GOVERNANCE_POLICY_VERSION } from "./policy-defaults";
import type {
  CreatorIntelligenceTier,
  EnrichmentPolicySlice,
  GovernancePolicyConfig,
  PlatformPolicyKey,
  PolicyResolutionContext,
  ResolvedEnrichmentPolicy,
} from "./policy-types";

export type { ResolvedEnrichmentPolicy };

let governancePolicy: GovernancePolicyConfig = DEFAULT_GOVERNANCE_POLICY;

export function getGovernancePolicy(): GovernancePolicyConfig {
  return governancePolicy;
}

export function setGovernancePolicyForTests(
  overrides: Partial<GovernancePolicyConfig>
): void {
  governancePolicy = Object.freeze({
    ...governancePolicy,
    ...overrides,
    rulePriorities: Object.freeze({
      ...governancePolicy.rulePriorities,
      ...(overrides.rulePriorities ?? {}),
    }),
    platformPolicies: Object.freeze({
      ...governancePolicy.platformPolicies,
      ...(overrides.platformPolicies ?? {}),
    }),
    tierPolicies: Object.freeze({
      ...governancePolicy.tierPolicies,
      ...(overrides.tierPolicies ?? {}),
    }),
    campaignPolicies: Object.freeze({
      ...governancePolicy.campaignPolicies,
      ...(overrides.campaignPolicies ?? {}),
    }),
    featureFreshnessOverrides: Object.freeze({
      ...governancePolicy.featureFreshnessOverrides,
      ...(overrides.featureFreshnessOverrides ?? {}),
    }),
    healthScoreWeights: Object.freeze({
      ...governancePolicy.healthScoreWeights,
      ...(overrides.healthScoreWeights ?? {}),
    }),
  });
}

export function resetGovernancePolicyForTests(): void {
  governancePolicy = DEFAULT_GOVERNANCE_POLICY;
}

function normalizePlatform(value: unknown): PlatformPolicyKey | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (
    key === "instagram" ||
    key === "tiktok" ||
    key === "youtube" ||
    key === "twitter" ||
    key === "linkedin"
  ) {
    return key;
  }
  return null;
}

function normalizeTier(value: unknown): CreatorIntelligenceTier | null {
  if (value === "standard" || value === "priority" || value === "vip") return value;
  return null;
}

export function buildPolicyResolutionContext(input: {
  context: CreatorEnrichmentDecisionContext;
  snapshot: CreatorIntelligenceSnapshot;
}): PolicyResolutionContext {
  const metadata = input.snapshot.metadata;
  return Object.freeze({
    feature: input.context.feature,
    force: input.context.force,
    requestedBy: input.context.requestedBy,
    platform: normalizePlatform(metadata.platform),
    tier: normalizeTier(metadata.creatorTier),
    campaignId:
      typeof metadata.campaignId === "string" ? metadata.campaignId : null,
  });
}

function mergeSlice(
  base: EnrichmentPolicySlice,
  patch: Partial<EnrichmentPolicySlice> | undefined,
  applied: string[],
  label: string
): EnrichmentPolicySlice {
  if (!patch) return base;
  applied.push(label);
  return Object.freeze({
    ...base,
    ...patch,
  });
}

function baseSliceFromConfig(config: GovernancePolicyConfig): EnrichmentPolicySlice {
  return Object.freeze({
    freshnessWindowDays: config.freshnessWindowDays,
    maxEnrichmentFrequencyDays: config.maxEnrichmentFrequencyDays,
    iplValidityDays: config.iplValidityDays,
    dnaCompletenessThreshold: config.dnaCompletenessThreshold,
    avatarValidityDays: config.avatarValidityDays,
    audienceValidityDays: config.audienceValidityDays,
    allowForceRefresh: config.allowForceRefresh,
    costLimitApifyCredits: config.costLimitApifyCredits,
    priorityOverride: null,
  });
}

/** Pure policy resolution — zero I/O. */
export function resolveEnrichmentPolicy(input: {
  resolutionContext: PolicyResolutionContext;
  config?: GovernancePolicyConfig;
}): ResolvedEnrichmentPolicy {
  const config = input.config ?? getGovernancePolicy();
  const appliedPolicyIds: string[] = ["global"];
  let slice = baseSliceFromConfig(config);

  slice = mergeSlice(
    slice,
    config.featureFreshnessOverrides[input.resolutionContext.feature],
    appliedPolicyIds,
    `feature:${input.resolutionContext.feature}`
  );

  if (input.resolutionContext.tier) {
    slice = mergeSlice(
      slice,
      config.tierPolicies[input.resolutionContext.tier],
      appliedPolicyIds,
      `tier:${input.resolutionContext.tier}`
    );
  }

  if (input.resolutionContext.platform) {
    slice = mergeSlice(
      slice,
      config.platformPolicies[input.resolutionContext.platform],
      appliedPolicyIds,
      `platform:${input.resolutionContext.platform}`
    );
  }

  if (input.resolutionContext.campaignId) {
    slice = mergeSlice(
      slice,
      config.campaignPolicies[input.resolutionContext.campaignId],
      appliedPolicyIds,
      `campaign:${input.resolutionContext.campaignId}`
    );
  }

  return Object.freeze({
    ...slice,
    policyVersion: config.version ?? GOVERNANCE_POLICY_VERSION,
    appliedPolicyIds: Object.freeze([...appliedPolicyIds]),
    queueInflightTimeoutMs: config.queueInflightTimeoutMs,
    rulePriorities: config.rulePriorities,
    healthScoreWeights: config.healthScoreWeights,
  });
}

export function resolveEnrichmentPolicyForRequest(input: {
  context: CreatorEnrichmentDecisionContext;
  snapshot: CreatorIntelligenceSnapshot;
}): ResolvedEnrichmentPolicy {
  return resolveEnrichmentPolicy({
    resolutionContext: buildPolicyResolutionContext(input),
  });
}

export function isMetricsFreshForPolicy(
  lastSuccessfulEnrichment: string | null,
  freshnessWindowDays: number,
  now = Date.now()
): boolean {
  if (!lastSuccessfulEnrichment) return false;
  const ts = Date.parse(lastSuccessfulEnrichment);
  if (Number.isNaN(ts)) return false;
  return now - ts < freshnessWindowDays * 24 * 60 * 60 * 1000;
}

export function isWithinPolicyDays(
  isoTimestamp: string | null,
  days: number,
  now = Date.now()
): boolean {
  if (!isoTimestamp) return false;
  const ts = Date.parse(isoTimestamp);
  if (Number.isNaN(ts)) return false;
  return now - ts < days * 24 * 60 * 60 * 1000;
}
