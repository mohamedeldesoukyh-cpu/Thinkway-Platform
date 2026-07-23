import {
  ENRICHMENT_STALE_AFTER_DAYS,
  STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS,
} from "@/lib/creator-enrichment/constants";

import type { GovernancePolicyConfig } from "./policy-types";

export const GOVERNANCE_POLICY_VERSION = "4.0.0";

export const DEFAULT_RULE_PRIORITIES = Object.freeze({
  ForceRule: 500,
  QueueRule: 400,
  FreshnessRule: 300,
  IPLRule: 200,
  DNARule: 150,
  CacheRule: 100,
  CostRule: 50,
});

export const DEFAULT_HEALTH_SCORE_WEIGHTS = Object.freeze({
  metrics: 0.25,
  dna: 0.25,
  audience: 0.15,
  ipl: 0.15,
  avatar: 0.1,
  ai: 0.1,
});

export const DEFAULT_GOVERNANCE_POLICY: GovernancePolicyConfig = Object.freeze({
  version: GOVERNANCE_POLICY_VERSION,
  freshnessWindowDays: ENRICHMENT_STALE_AFTER_DAYS,
  maxEnrichmentFrequencyDays: ENRICHMENT_STALE_AFTER_DAYS,
  queueInflightTimeoutMs: STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS,
  iplValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
  dnaCompletenessThreshold: 70,
  avatarValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
  audienceValidityDays: ENRICHMENT_STALE_AFTER_DAYS,
  allowForceRefresh: true,
  costLimitApifyCredits: null,
  rulePriorities: DEFAULT_RULE_PRIORITIES,
  platformPolicies: Object.freeze({
    tiktok: Object.freeze({
      freshnessWindowDays: 21,
      iplValidityDays: 21,
    }),
    instagram: Object.freeze({
      freshnessWindowDays: 30,
    }),
  }),
  tierPolicies: Object.freeze({
    vip: Object.freeze({
      freshnessWindowDays: 14,
      maxEnrichmentFrequencyDays: 14,
      dnaCompletenessThreshold: 85,
    }),
    priority: Object.freeze({
      freshnessWindowDays: 21,
      dnaCompletenessThreshold: 75,
    }),
  }),
  campaignPolicies: Object.freeze({}),
  featureFreshnessOverrides: Object.freeze({
    campaign_studio: Object.freeze({
      freshnessWindowDays: 14,
    }),
  }),
  healthScoreWeights: DEFAULT_HEALTH_SCORE_WEIGHTS,
});
