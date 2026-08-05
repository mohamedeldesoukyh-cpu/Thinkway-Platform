import type { SupabaseClient } from "@supabase/supabase-js";

import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import {
  extractEmailFromText,
  mergeContactLinks,
  normalizeContactLink,
} from "@/lib/creators/contact-info";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import { refreshCreatorPlatformMetrics } from "@/lib/services/creators/creator-enrichment-service";
import { findDuplicatePlatformAccounts } from "@/lib/social/duplicate-check";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";
import { resolveMetricsSourceForEnrichment } from "@/lib/social/enrichment/metrics-status";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import { parseProfileInput } from "@/lib/social/parse-profile-url";
import { isSocialPlatform } from "@/lib/social/platforms";
import type { Database } from "@/types/database";

export type AddPlatformToCreatorResult =
  | {
      ok: true;
      creator: UnifiedCreatorResult;
      platformAccountId: string;
      enrichmentQueued: boolean;
      message: string;
    }
  | { ok: false; message: string };

async function resolveInfluencerId(
  supabase: SupabaseClient<Database>,
  input: {
    influencerId?: string | null;
    discoveredProfileId?: string | null;
    actorId: string;
  }
): Promise<{ ok: true; influencerId: string } | { ok: false; message: string }> {
  if (input.influencerId) {
    return { ok: true, influencerId: input.influencerId };
  }
  if (input.discoveredProfileId) {
    const promoted = await promoteDiscoveredProfileToInfluencer(
      supabase,
      input.discoveredProfileId,
      input.actorId
    );
    if (!promoted.ok) return promoted;
    return { ok: true, influencerId: promoted.influencerId };
  }
  return {
    ok: false,
    message: "This creator cannot accept new platforms yet.",
  };
}

/**
 * Attach a new social profile URL to an existing creator, enrich it, and queue Apify refresh.
 */
export async function addPlatformToCreator(
  supabase: SupabaseClient<Database>,
  input: {
    profileUrl: string;
    actorId: string;
    influencerId?: string | null;
    discoveredProfileId?: string | null;
    unifiedId: string;
  }
): Promise<AddPlatformToCreatorResult> {
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

  const resolved = await resolveInfluencerId(supabase, {
    influencerId: input.influencerId,
    discoveredProfileId: input.discoveredProfileId,
    actorId: input.actorId,
  });
  if (!resolved.ok) return resolved;

  const influencerId = resolved.influencerId;

  const { data: existingOnCreator, error: existingError } = await supabase
    .from("influencer_platform_accounts")
    .select("id, platform, normalized_username")
    .eq("influencer_id", influencerId)
    .eq("platform", parsed.platform);

  if (existingError) {
    return { ok: false, message: existingError.message };
  }

  const duplicateOnCreator = (existingOnCreator ?? []).find(
    (row) => row.normalized_username === parsed.normalized_username
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
  });

  if (duplicates.length > 0) {
    const other = duplicates[0]!;
    return {
      ok: false,
      message: `This profile is already linked to ${other.influencer_name}.`,
    };
  }

  let enrichment = null;
  try {
    enrichment = await enrichCreatorProfile({
      platform: parsed.platform,
      username: parsed.username,
      profile_url: parsed.profile_url,
    });
  } catch {
    // Open-graph enrichment must not block platform linking.
  }

  const normalized = buildNormalizedPlatformAccount({
    platform: parsed.platform,
    username: parsed.username,
    profile_url: parsed.profile_url,
    follower_count: enrichment?.follower_count ?? null,
    following_count: enrichment?.following_count ?? null,
    engagement_rate: enrichment?.engagement_rate ?? null,
    avg_views: enrichment?.avg_views ?? null,
    profile_display_name: formatCreatorDisplayName(enrichment?.display_name) || null,
    profile_bio: enrichment?.bio ?? null,
    profile_picture_url: enrichment?.profile_picture_url ?? null,
    is_verified: enrichment?.is_verified ?? false,
    sync_status: enrichment?.sync_status ?? "partial",
    sync_source: enrichment?.sync_source ?? "discovery_add_platform",
    sync_error: enrichment?.sync_error ?? null,
    last_synced_at: enrichment ? new Date().toISOString() : null,
    metrics_source: resolveMetricsSourceForEnrichment({
      platform: parsed.platform,
      follower_count: enrichment?.follower_count ?? null,
      engagement_rate: enrichment?.engagement_rate ?? null,
      avg_views: enrichment?.avg_views ?? null,
      sync_status: enrichment?.sync_status ?? "partial",
    }),
    metrics_last_synced_at: enrichment ? new Date().toISOString() : null,
    metrics_is_manual_override: false,
  });

  const profileBio = enrichment?.bio ?? null;
  const contactEmail = extractEmailFromText(profileBio);
  const contactLinks = mergeContactLinks(
    null,
    normalizeContactLink(parsed.profile_url) ? [parsed.profile_url] : null
  );

  const isPrimary = (existingOnCreator ?? []).length === 0;

  const { data: inserted, error: insertError } = await supabase
    .from("influencer_platform_accounts")
    .insert({
      influencer_id: influencerId,
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
      contact_email: contactEmail,
      contact_links: contactLinks.length > 0 ? contactLinks : null,
      is_primary: isPrimary,
      ...(normalized.profile_picture_url
        ? {
            avatar_source: enrichment?.profile_picture_url ? "discovery" : "manual",
            avatar_last_synced_at: new Date().toISOString(),
          }
        : {}),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      message: insertError?.message ?? "Failed to link platform profile.",
    };
  }

  if (normalized.profile_picture_url) {
    await persistCreatorPrimaryIdentity(supabase, influencerId);
  }

  const refresh = await refreshCreatorPlatformMetrics(
    supabase,
    influencerId,
    inserted.id,
    {
      force: true,
      trigger: "manual",
      requestedBy: input.actorId,
      feature: "add_platform",
    }
  );

  const unifiedId = input.unifiedId.startsWith("inf:")
    ? input.unifiedId
    : `inf:${influencerId}`;
  const creator = await getUnifiedCreatorById(supabase, unifiedId);
  if (!creator) {
    return { ok: false, message: "Platform linked but creator could not be reloaded." };
  }

  const platformLabel =
    parsed.platform.charAt(0).toUpperCase() + parsed.platform.slice(1);

  return {
    ok: true,
    creator,
    platformAccountId: inserted.id,
    enrichmentQueued: refresh.queued,
    message: refresh.queued
      ? `${platformLabel} profile linked — enrichment queued.`
      : `${platformLabel} profile linked. ${refresh.message}`,
  };
}
