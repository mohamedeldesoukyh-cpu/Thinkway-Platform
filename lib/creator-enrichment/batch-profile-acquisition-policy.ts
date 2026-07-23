/**
 * Configuration for batch profile acquisition (Apify actor runs with many profile URLs).
 */

import type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";

import { shouldIncludeApifyProfilePosts } from "./apify-fetch-policy";

export type BatchProfileAcquisitionConfig = {
  /** Max profile URLs per Apify actor run (per platform). */
  batchSize: number;
  /** Retries when an Apify actor launch/fetch fails. */
  maxRetries: number;
  /** Base delay between retries (ms); doubled each attempt. */
  retryBackoffMs: number;
  /** Actor wait timeout per batch run (ms). */
  timeoutMs: number;
  /** Estimated Apify compute units per profile for a details scrape. */
  estimatedCreditsPerProfileDetails: number;
  /** Estimated Apify compute units per profile for a posts scrape (Instagram). */
  estimatedCreditsPerProfilePosts: number;
  /** When true, bulk refresh uses batch acquisition instead of per-creator queue jobs. */
  batchAcquisitionEnabled: boolean;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parsePositiveFloat(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envTruthy(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return defaultValue;
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  return defaultValue;
}

export function getBatchProfileAcquisitionConfig(): BatchProfileAcquisitionConfig {
  return {
    batchSize: parsePositiveInt(process.env.BATCH_PROFILE_ACQUISITION_SIZE?.trim(), 75),
    maxRetries: parsePositiveInt(process.env.BATCH_PROFILE_ACQUISITION_MAX_RETRIES?.trim(), 3),
    retryBackoffMs: parsePositiveInt(
      process.env.BATCH_PROFILE_ACQUISITION_RETRY_BACKOFF_MS?.trim(),
      5_000
    ),
    timeoutMs: parsePositiveInt(
      process.env.BATCH_PROFILE_ACQUISITION_TIMEOUT_MS?.trim(),
      180_000
    ),
    estimatedCreditsPerProfileDetails: parsePositiveFloat(
      process.env.BATCH_PROFILE_ESTIMATED_CREDITS_DETAILS?.trim(),
      0.004
    ),
    estimatedCreditsPerProfilePosts: parsePositiveFloat(
      process.env.BATCH_PROFILE_ESTIMATED_CREDITS_POSTS?.trim(),
      0.003
    ),
    batchAcquisitionEnabled: envTruthy("BATCH_PROFILE_ACQUISITION_ENABLED", true),
  };
}

/** Estimate Apify runs and credits for a batch profile acquisition plan. */
export function estimateBatchProfileAcquisitionUsage(input: {
  profileCount: number;
  platform: string;
  /** Enrichment scope — metrics refresh skips the Instagram posts actor. */
  scope?: EnrichmentScope;
  config?: BatchProfileAcquisitionConfig;
}): {
  estimatedApifyRuns: number;
  estimatedCredits: number;
  batchCount: number;
} {
  const config = input.config ?? getBatchProfileAcquisitionConfig();
  const count = Math.max(0, input.profileCount);
  const batchCount = count === 0 ? 0 : Math.ceil(count / config.batchSize);
  const includesPostsBatch =
    input.platform === "instagram" && shouldIncludeApifyProfilePosts(input.scope);
  const runsPerBatch = includesPostsBatch ? 2 : 1;
  const estimatedApifyRuns = batchCount * runsPerBatch;
  const creditsPerProfile =
    config.estimatedCreditsPerProfileDetails +
    (includesPostsBatch ? config.estimatedCreditsPerProfilePosts : 0);
  const estimatedCredits = Number((count * creditsPerProfile).toFixed(4));

  return { estimatedApifyRuns, estimatedCredits, batchCount };
}
