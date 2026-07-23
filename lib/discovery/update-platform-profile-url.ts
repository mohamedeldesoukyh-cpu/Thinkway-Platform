import type { SupabaseClient } from "@supabase/supabase-js";

import { platformLabel } from "@/lib/campaigns/line-assignment";
import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { refreshCreatorPlatformMetrics } from "@/lib/services/creators/creator-enrichment-service";
import { findDuplicatePlatformAccounts } from "@/lib/social/duplicate-check";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";
import { resolveMetricsSourceForEnrichment } from "@/lib/social/enrichment/metrics-status";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import { parseProfileInput } from "@/lib/social/parse-profile-url";
import { isSocialPlatform } from "@/lib/social/platforms";
import type { Database } from "@/types/database";

export type UpdatePlatformProfileUrlResult =
  | {
      ok: true;
      creator: UnifiedCreatorResult;
      enrichmentQueued: boolean;
      message: string;
    }
  | { ok: false; message: string };

/**
 * Replace the profile URL on an existing platform account, re-normalize identity
 * fields, and queue enrichment when the linked profile changes.
 */
export async function updatePlatformProfileUrl(
  supabase: SupabaseClient<Database>,
  input: {
    influencerId: string;
    platformAccountId: string;
    unifiedId: string;
    profileUrl: string;
    actorId: string;
  }
): Promise<UpdatePlatformProfileUrlResult> {
  const trimmed = input.profileUrl.trim();
  const parsed = parseProfileInput(trimmed);

  if (!parsed) {
    return {
      ok: false,
      message: "Could not detect platform or username from this URL.",
    };
  }

  if (!isSocialPlatform(parsed.platform)) {
    return { ok: false, message: "Unsupported platform." };
  }

  const influencerId = input.influencerId.trim();
  const platformAccountId = input.platformAccountId.trim();
  const unifiedId = input.unifiedId.trim();

  if (!influencerId || !platformAccountId || !unifiedId) {
    return { ok: false, message: "Creator and platform are required." };
  }

  const { data: account, error: accountError } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, normalized_username, normalized_profile_url, profile_url, profile_display_name, profile_bio, profile_picture_url, follower_count, following_count, engagement_rate, avg_views, is_verified, sync_status, sync_source, sync_error, last_synced_at, metrics_source, metrics_last_synced_at, metrics_is_manual_override"
    )
    .eq("id", platformAccountId)
    .eq("influencer_id", influencerId)
    .maybeSingle();

  if (accountError) {
    return { ok: false, message: accountError.message };
  }

  if (!account) {
    return { ok: false, message: "Platform account not found on this creator." };
  }

  if (account.platform !== parsed.platform) {
    return {
      ok: false,
      message: `Enter a ${platformLabel(account.platform)} profile URL to replace this account.`,
    };
  }

  if (
    account.normalized_profile_url === parsed.normalized_profile_url &&
    account.normalized_username === parsed.normalized_username
  ) {
    const creator = await getUnifiedCreatorById(supabase, unifiedId);
    if (!creator) {
      return { ok: false, message: "Profile URL unchanged but creator could not be reloaded." };
    }
    return {
      ok: true,
      creator,
      enrichmentQueued: false,
      message: "Profile URL is already up to date.",
    };
  }

  const { data: siblingAccounts, error: siblingsError } = await supabase
    .from("influencer_platform_accounts")
    .select("id, normalized_username")
    .eq("influencer_id", influencerId)
    .eq("platform", parsed.platform);

  if (siblingsError) {
    return { ok: false, message: siblingsError.message };
  }

  const duplicateOnCreator = (siblingAccounts ?? []).find(
    (row) =>
      row.id !== platformAccountId && row.normalized_username === parsed.normalized_username
  );
  if (duplicateOnCreator) {
    return {
      ok: false,
      message: `${parsed.platform} @${parsed.normalized_username} is already linked to this creator.`,
    };
  }

  const duplicates = await findDuplicatePlatformAccounts(supabase, {
    platform: parsed.platform,
    normalized_username: parsed.normalized_username,
    normalized_profile_url: parsed.normalized_profile_url,
    exclude_influencer_id: influencerId,
    exclude_account_id: platformAccountId,
  });

  if (duplicates.length > 0) {
    const other = duplicates[0]!;
    return {
      ok: false,
      message: `This profile is already linked to ${other.influencer_name}.`,
    };
  }

  const identityChanged = account.normalized_username !== parsed.normalized_username;

  let enrichment = null;
  if (identityChanged) {
    try {
      enrichment = await enrichCreatorProfile({
        platform: parsed.platform,
        username: parsed.username,
        profile_url: parsed.profile_url,
      });
    } catch {
      // Open-graph enrichment must not block URL replacement.
    }
  }

  const normalized = buildNormalizedPlatformAccount({
    platform: parsed.platform,
    username: parsed.username,
    profile_url: parsed.profile_url,
    follower_count: identityChanged
      ? (enrichment?.follower_count ?? null)
      : account.follower_count,
    following_count: identityChanged
      ? (enrichment?.following_count ?? null)
      : account.following_count,
    engagement_rate: identityChanged
      ? (enrichment?.engagement_rate ?? null)
      : account.engagement_rate,
    avg_views: identityChanged ? (enrichment?.avg_views ?? null) : account.avg_views,
    profile_display_name: identityChanged
      ? enrichment?.display_name ?? account.profile_display_name
      : account.profile_display_name,
    profile_bio: identityChanged ? (enrichment?.bio ?? null) : account.profile_bio,
    profile_picture_url: identityChanged
      ? (enrichment?.profile_picture_url ?? null)
      : account.profile_picture_url,
    is_verified: identityChanged
      ? (enrichment?.is_verified ?? false)
      : (account.is_verified ?? false),
    sync_status: identityChanged
      ? (enrichment?.sync_status ?? "partial")
      : (account.sync_status ?? "partial"),
    sync_source: identityChanged
      ? (enrichment?.sync_source ?? "discovery_edit_profile_url")
      : (account.sync_source ?? "discovery_edit_profile_url"),
    sync_error: identityChanged ? (enrichment?.sync_error ?? null) : account.sync_error,
    last_synced_at: identityChanged
      ? enrichment
        ? new Date().toISOString()
        : account.last_synced_at
      : account.last_synced_at,
    metrics_source: identityChanged
      ? resolveMetricsSourceForEnrichment({
          platform: parsed.platform,
          follower_count: enrichment?.follower_count ?? null,
          engagement_rate: enrichment?.engagement_rate ?? null,
          avg_views: enrichment?.avg_views ?? null,
          sync_status: enrichment?.sync_status ?? "partial",
        })
      : (account.metrics_source ?? "unavailable"),
    metrics_last_synced_at: identityChanged
      ? enrichment
        ? new Date().toISOString()
        : account.metrics_last_synced_at
      : account.metrics_last_synced_at,
    metrics_is_manual_override: identityChanged
      ? false
      : (account.metrics_is_manual_override ?? false),
  });

  const { error: updateError } = await supabase
    .from("influencer_platform_accounts")
    .update({
      platform: normalized.platform,
      handle: normalized.handle,
      username: normalized.username,
      normalized_username: normalized.normalized_username,
      profile_url: normalized.profile_url,
      normalized_profile_url: normalized.normalized_profile_url,
      profile_display_name: normalized.profile_display_name,
      profile_bio: normalized.profile_bio,
      profile_picture_url: normalized.profile_picture_url,
      follower_count: normalized.follower_count ?? 0,
      following_count: normalized.following_count,
      engagement_rate: normalized.engagement_rate,
      avg_views: normalized.avg_views,
      is_verified: normalized.is_verified,
      sync_status: normalized.sync_status,
      sync_source: normalized.sync_source,
      sync_error: normalized.sync_error,
      last_synced_at: normalized.last_synced_at,
      metrics_source: normalized.metrics_source,
      metrics_last_synced_at: normalized.metrics_last_synced_at,
      metrics_is_manual_override: normalized.metrics_is_manual_override,
      ...(identityChanged && normalized.profile_picture_url
        ? {
            avatar_source: enrichment?.profile_picture_url ? "discovery" : "manual",
            avatar_last_synced_at: new Date().toISOString(),
          }
        : {}),
    })
    .eq("id", platformAccountId)
    .eq("influencer_id", influencerId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  if (identityChanged && normalized.profile_picture_url) {
    await persistCreatorPrimaryIdentity(supabase, influencerId);
  }

  const refresh = await refreshCreatorPlatformMetrics(
    supabase,
    influencerId,
    platformAccountId,
    {
      force: identityChanged,
      trigger: "manual",
      requestedBy: input.actorId,
      feature: "manual_refresh",
    }
  );

  const creator = await getUnifiedCreatorById(supabase, unifiedId);
  if (!creator) {
    return { ok: false, message: "Profile URL updated but creator could not be reloaded." };
  }

  const label = platformLabel(parsed.platform);

  return {
    ok: true,
    creator,
    enrichmentQueued: refresh.queued,
    message: refresh.queued
      ? `${label} profile URL updated — enrichment queued.`
      : identityChanged
        ? `${label} profile URL updated. ${refresh.message}`
        : `${label} profile URL updated.`,
  };
}
