import type { CreatorEnrichmentFeature } from "@/lib/creator-enrichment/enrichment-feature";
import type { DecisionRuleId } from "@/lib/creator-enrichment/decision/decision-policy";

export type CreatorIntelligenceTier = "standard" | "priority" | "vip";

export type PlatformPolicyKey = "default" | "instagram" | "tiktok" | "youtube" | "twitter" | "linkedin";

export type EnrichmentPolicySlice = Readonly<{
  freshnessWindowDays: number;
  maxEnrichmentFrequencyDays: number;
  iplValidityDays: number;
  dnaCompletenessThreshold: number;
  avatarValidityDays: number;
  audienceValidityDays: number;
  allowForceRefresh: boolean;
  costLimitApifyCredits: number | null;
  priorityOverride: number | null;
}>;

export type HealthScoreWeights = Readonly<{
  metrics: number;
  dna: number;
  audience: number;
  ipl: number;
  avatar: number;
  ai: number;
}>;

export type GovernancePolicyConfig = Readonly<{
  version: string;
  freshnessWindowDays: number;
  maxEnrichmentFrequencyDays: number;
  queueInflightTimeoutMs: number;
  iplValidityDays: number;
  dnaCompletenessThreshold: number;
  avatarValidityDays: number;
  audienceValidityDays: number;
  allowForceRefresh: boolean;
  costLimitApifyCredits: number | null;
  rulePriorities: Readonly<Record<DecisionRuleId, number>>;
  platformPolicies: Readonly<Partial<Record<PlatformPolicyKey, Partial<EnrichmentPolicySlice>>>>;
  tierPolicies: Readonly<Partial<Record<CreatorIntelligenceTier, Partial<EnrichmentPolicySlice>>>>;
  campaignPolicies: Readonly<Record<string, Partial<EnrichmentPolicySlice>>>;
  featureFreshnessOverrides: Readonly<
    Partial<Record<CreatorEnrichmentFeature, Partial<EnrichmentPolicySlice>>>
  >;
  healthScoreWeights: HealthScoreWeights;
}>;

export type PolicyResolutionContext = Readonly<{
  feature: CreatorEnrichmentFeature;
  force: boolean;
  requestedBy: string | null;
  platform: PlatformPolicyKey | null;
  tier: CreatorIntelligenceTier | null;
  campaignId: string | null;
}>;

export type ResolvedEnrichmentPolicy = Readonly<
  EnrichmentPolicySlice & {
    policyVersion: string;
    appliedPolicyIds: readonly string[];
    freshnessWindowDays: number;
    queueInflightTimeoutMs: number;
    rulePriorities: Readonly<Record<DecisionRuleId, number>>;
    healthScoreWeights: HealthScoreWeights;
  }
>;
