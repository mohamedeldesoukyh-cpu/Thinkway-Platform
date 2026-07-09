/**
 * Creator DNA completeness scoring — 0..100 across eight dimensions.
 * Demographic fields without provider data surface as verificationRequired.
 */

import type {
  CreatorDNADocument,
  DnaCompletenessDimension,
  DnaCompletenessResult,
  FieldEnvelope,
} from "../types";
import { envelopeHasValue } from "./field-envelope";

const DIMENSION_WEIGHT = 100 / 8;

const VERIFICATION_REQUIRED_PATHS = [
  "audience.audienceGender",
  "audience.audienceAgeBands",
  "audience.audienceCities",
  "audience.languagePrimary",
] as const;

type FieldSpec = { path: string; weight: number };

const DIMENSION_FIELDS: Record<DnaCompletenessDimension, FieldSpec[]> = {
  identity: [
    { path: "identity.displayName", weight: 1 },
    { path: "identity.bio", weight: 1 },
    { path: "identity.avatarUrl", weight: 1 },
    { path: "identity.handle", weight: 1 },
    { path: "identity.platform", weight: 1 },
    { path: "identity.isVerified", weight: 0.5 },
  ],
  platforms: [
    { path: "platforms.primaryPlatform", weight: 1 },
    { path: "platforms.accountCount", weight: 1 },
    { path: "platforms.crossPlatformReach", weight: 0.5 },
    { path: "meta.platformAccountIds", weight: 1 },
  ],
  audience: [
    { path: "audience.country", weight: 1 },
    { path: "audience.countries", weight: 0.5 },
    { path: "audience.cities", weight: 0.5 },
    { path: "audience.languages", weight: 0.5 },
    { path: "audience.interests", weight: 1 },
  ],
  categories: [
    { path: "audience.categories", weight: 1.5 },
    { path: "scores.aiCategory", weight: 1 },
    { path: "scores.aiNiche", weight: 0.5 },
  ],
  content: [
    { path: "identity.bio", weight: 1 },
    { path: "audience.hashtags", weight: 1 },
    { path: "audience.mentions", weight: 0.5 },
    { path: "metrics.postsCount", weight: 0.5 },
  ],
  commercial: [
    { path: "commercial.estimatedRate", weight: 1 },
    { path: "commercial.typicalDeliverables", weight: 1 },
    { path: "commercial.campaignFrequency", weight: 0.5 },
    { path: "commercial.responseSpeed", weight: 0.5 },
    { path: "commercial.historicalBrandCategories", weight: 1 },
  ],
  quality: [
    { path: "scores.authenticityScore", weight: 1 },
    { path: "brandSafety.engagementQuality", weight: 1 },
    { path: "brandSafety.fakeFollowers", weight: 0.5 },
    { path: "brandSafety.verificationLevel", weight: 0.5 },
    { path: "metrics.engagementRate", weight: 1 },
  ],
  historicalPerformance: [
    { path: "historicalPerformance.campaignsCompleted", weight: 1 },
    { path: "historicalPerformance.avgCampaignRoi", weight: 1 },
    { path: "historicalPerformance.repeatBrandRate", weight: 0.5 },
    { path: "historicalPerformance.onTimeDeliveryRate", weight: 0.5 },
    { path: "historicalPerformance.avgEngagementTrend", weight: 0.5 },
  ],
};

function getEnvelopeAtPath(
  document: CreatorDNADocument,
  path: string
): FieldEnvelope<unknown> | undefined {
  if (path === "meta.platformAccountIds") {
    const ids = document.meta.platformAccountIds ?? [];
    return {
      value: ids,
      confidence: ids.length > 0 ? 0.9 : 0,
      source: "ipl",
      sourceVersion: null,
      updatedAt: document.meta.lastMergedAt ?? new Date(0).toISOString(),
      history: [],
    };
  }

  const parts = path.split(".");
  let cursor: unknown = document;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (cursor == null || typeof cursor !== "object") return undefined;
  const env = cursor as FieldEnvelope<unknown>;
  if (!("value" in env) || !("confidence" in env)) return undefined;
  return env;
}

function scoreField(envelope: FieldEnvelope<unknown> | undefined): number {
  if (!envelopeHasValue(envelope)) return 0;
  const confidenceBoost = Math.max(0, Math.min(1, envelope?.confidence ?? 0));
  return 0.6 + confidenceBoost * 0.4;
}

function scoreDimension(
  document: CreatorDNADocument,
  dimension: DnaCompletenessDimension,
  missingFields: string[]
): number {
  const specs = DIMENSION_FIELDS[dimension];
  let totalWeight = 0;
  let earned = 0;

  for (const spec of specs) {
    totalWeight += spec.weight;
    const envelope = getEnvelopeAtPath(document, spec.path);
    const fieldScore = scoreField(envelope);
    if (fieldScore === 0) {
      missingFields.push(spec.path);
    }
    earned += spec.weight * fieldScore;
  }

  if (totalWeight === 0) return 0;
  return Math.round((earned / totalWeight) * DIMENSION_WEIGHT);
}

function collectVerificationRequired(document: CreatorDNADocument): string[] {
  const required: string[] = [];

  for (const path of VERIFICATION_REQUIRED_PATHS) {
    const envelope = getEnvelopeAtPath(document, path);
    if (!envelopeHasValue(envelope) || (envelope?.confidence ?? 0) < 0.5) {
      required.push(path);
    }
  }

  return required;
}

/** Score DNA document completeness 0..100 with per-dimension breakdown. */
export function calculateDnaCompleteness(document: CreatorDNADocument): DnaCompletenessResult {
  const missingFields: string[] = [];
  const dimensionScores = {} as Record<DnaCompletenessDimension, number>;

  for (const dimension of Object.keys(DIMENSION_FIELDS) as DnaCompletenessDimension[]) {
    dimensionScores[dimension] = scoreDimension(document, dimension, missingFields);
  }

  const dnaCompleteness = Math.min(
    100,
    Math.round(Object.values(dimensionScores).reduce((sum, score) => sum + score, 0))
  );

  return {
    dnaCompleteness,
    dimensionScores,
    missingFields: [...new Set(missingFields)],
    verificationRequired: collectVerificationRequired(document),
  };
}

/** Historical performance sub-score 0..1 for ranking. */
export function historicalPerformanceRankScore(document: CreatorDNADocument): number {
  const perf = document.historicalPerformance;
  const parts = [
    perf.campaignsCompleted.value,
    perf.avgCampaignRoi.value,
    perf.repeatBrandRate.value,
    perf.onTimeDeliveryRate.value,
  ].filter((v) => v != null);

  if (parts.length === 0) return 0.35;
  const normalized = parts.map((v) => Math.min(1, Number(v) / 100));
  return normalized.reduce((a, b) => a + b, 0) / normalized.length;
}
