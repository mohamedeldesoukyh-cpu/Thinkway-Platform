import type { SupabaseClient } from "@supabase/supabase-js";

import { findLatestFreshSnapshot } from "@/lib/intelligence-persistence/services/snapshot-service";

import type { EnrichmentScope } from "./enabled";
import {
  getManualRefreshCachePromptThresholdHours,
  shouldPromptManualRefreshCache,
} from "./manual-refresh-policy";

type AnySupabase = SupabaseClient;

export type ManualRefreshCacheAssessment = {
  shouldPrompt: boolean;
  hasValidSnapshot: boolean;
  lastEnrichedAt: string | null;
  lastLiveFetchAt: string | null;
  snapshotAgeMs: number | null;
  snapshotExpiresAt: string | null;
  snapshotId: string | null;
  promptThresholdHours: number;
  reason: string;
};

type PlatformAccountRow = {
  id: string;
  platform: string;
};

function resolveSnapshotAgeMs(fetchedAt: string | null, now: number): number | null {
  if (!fetchedAt) return null;
  const ts = Date.parse(fetchedAt);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, now - ts);
}

/**
 * Inspect IPL snapshots + enrichment timestamps to decide whether manual refresh
 * should offer cache vs live Apify.
 */
export async function assessManualRefreshCache(
  supabase: AnySupabase,
  input: {
    influencerId: string;
    platformAccountId?: string | null;
    scope?: EnrichmentScope;
    now?: Date;
  }
): Promise<ManualRefreshCacheAssessment> {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const promptThresholdHours = getManualRefreshCachePromptThresholdHours();

  const { data: creator, error: creatorError } = await supabase
    .from("influencers")
    .select("last_enriched_at")
    .eq("id", input.influencerId)
    .maybeSingle();

  if (creatorError) {
    return {
      shouldPrompt: false,
      hasValidSnapshot: false,
      lastEnrichedAt: null,
      lastLiveFetchAt: null,
      snapshotAgeMs: null,
      snapshotExpiresAt: null,
      snapshotId: null,
      promptThresholdHours,
      reason: creatorError.message,
    };
  }

  const lastEnrichedAt =
    (creator as { last_enriched_at: string | null } | null)?.last_enriched_at ?? null;

  let accountsQuery = supabase
    .from("influencer_platform_accounts")
    .select("id, platform")
    .eq("influencer_id", input.influencerId);

  if (input.platformAccountId) {
    accountsQuery = accountsQuery.eq("id", input.platformAccountId);
  }

  const { data: accountsData, error: accountsError } = await accountsQuery;
  if (accountsError) {
    return {
      shouldPrompt: false,
      hasValidSnapshot: false,
      lastEnrichedAt,
      lastLiveFetchAt: null,
      snapshotAgeMs: null,
      snapshotExpiresAt: null,
      snapshotId: null,
      promptThresholdHours,
      reason: accountsError.message,
    };
  }

  const accounts = (accountsData ?? []) as PlatformAccountRow[];
  if (accounts.length === 0) {
    return {
      shouldPrompt: false,
      hasValidSnapshot: false,
      lastEnrichedAt,
      lastLiveFetchAt: null,
      snapshotAgeMs: null,
      snapshotExpiresAt: null,
      snapshotId: null,
      promptThresholdHours,
      reason: "No platform accounts linked to this creator.",
    };
  }

  let bestSnapshot: Awaited<ReturnType<typeof findLatestFreshSnapshot>> = null;

  for (const account of accounts) {
    const snapshot = await findLatestFreshSnapshot(supabase, {
      provider: "apify",
      platformAccountId: account.id,
    });
    if (!snapshot) continue;
    if (
      !bestSnapshot ||
      Date.parse(snapshot.fetchedAt) > Date.parse(bestSnapshot.fetchedAt)
    ) {
      bestSnapshot = snapshot;
    }
  }

  const hasValidSnapshot = Boolean(bestSnapshot);
  const lastLiveFetchAt = bestSnapshot?.fetchedAt ?? null;
  const snapshotAgeMs = resolveSnapshotAgeMs(lastLiveFetchAt, nowMs);
  const shouldPrompt = shouldPromptManualRefreshCache({
    hasValidSnapshot,
    lastEnrichedAt,
    lastLiveFetchAt,
    now: nowMs,
  });

  const reason = !hasValidSnapshot
    ? "No fresh IPL snapshot — live Apify refresh will run."
    : shouldPrompt
      ? `Fresh cached data available (within ${promptThresholdHours}h).`
      : "Snapshot exists but outside the recent-refresh prompt window — live refresh will run.";

  void input.scope;

  return {
    shouldPrompt,
    hasValidSnapshot,
    lastEnrichedAt,
    lastLiveFetchAt,
    snapshotAgeMs,
    snapshotExpiresAt: bestSnapshot?.expiresAt ?? null,
    snapshotId: bestSnapshot?.id ?? null,
    promptThresholdHours,
    reason,
  };
}
