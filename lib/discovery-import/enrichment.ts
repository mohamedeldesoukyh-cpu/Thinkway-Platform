import type { SupabaseClient } from "@supabase/supabase-js";

import { buildCanonicalProfileUrl, isSocialPlatform } from "@/lib/social/platforms";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";
import { resolveMetricsSourceForEnrichment } from "@/lib/social/enrichment/metrics-status";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import type { Database } from "@/types/database";

import { enqueueCreatorImportEnrichmentJob } from "./queue";
import type { CreatorImportEnrichmentJobPayload } from "./types";

export async function queueImportedCreatorEnrichment(
  accounts: Array<{
    influencerId: string;
    platformAccountId: string;
    platform: string;
    username: string;
  }>,
  importFileId?: string
): Promise<number> {
  let queued = 0;

  for (const account of accounts) {
    const payload: CreatorImportEnrichmentJobPayload = {
      ...account,
      importFileId,
    };
    const result = await enqueueCreatorImportEnrichmentJob(payload);
    if (result.queued) queued += 1;
  }

  return queued;
}

export async function enrichImportedPlatformAccount(
  supabase: SupabaseClient<Database>,
  payload: CreatorImportEnrichmentJobPayload
): Promise<{ ok: boolean; message: string }> {
  const { data: account, error } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, username, handle, profile_url, follower_count, engagement_rate, metrics_is_manual_override"
    )
    .eq("id", payload.platformAccountId)
    .maybeSingle();

  if (error || !account) {
    return { ok: false, message: error?.message ?? "Platform account not found." };
  }

  const platform = account.platform;
  const username = account.username ?? account.handle;
  const profileUrl =
    account.profile_url ??
    (isSocialPlatform(platform)
      ? buildCanonicalProfileUrl(platform, username)
      : null);
  if (!profileUrl) {
    return { ok: false, message: "Unsupported platform for enrichment." };
  }

  let enrichment = null;
  try {
    enrichment = await enrichCreatorProfile({
      platform: platform as Parameters<typeof enrichCreatorProfile>[0]["platform"],
      username,
      profile_url: profileUrl,
    });
  } catch (enrichError) {
    return {
      ok: false,
      message:
        enrichError instanceof Error ? enrichError.message : "Enrichment failed.",
    };
  }

  const manualFollowers = Boolean(account.metrics_is_manual_override);
  const normalized = buildNormalizedPlatformAccount({
    platform,
    username,
    profile_url: profileUrl,
    follower_count: manualFollowers
      ? account.follower_count
      : enrichment.follower_count ?? account.follower_count,
    following_count: enrichment.following_count,
    engagement_rate: manualFollowers
      ? account.engagement_rate
      : enrichment.engagement_rate ?? account.engagement_rate,
    profile_display_name: enrichment.display_name,
    profile_bio: enrichment.bio,
    profile_picture_url: enrichment.profile_picture_url,
    is_verified: enrichment.is_verified ?? false,
    sync_status: enrichment.sync_status,
    sync_source: enrichment.sync_source,
    sync_error: enrichment.sync_error,
    last_synced_at: new Date().toISOString(),
    metrics_source: resolveMetricsSourceForEnrichment({
      platform,
      follower_count: enrichment.follower_count,
      engagement_rate: enrichment.engagement_rate,
      avg_views: enrichment.avg_views,
      sync_status: enrichment.sync_status,
    }),
    metrics_last_synced_at: new Date().toISOString(),
    metrics_is_manual_override: manualFollowers,
  });

  const { error: updateError } = await supabase
    .from("influencer_platform_accounts")
    .update({
      profile_display_name: normalized.profile_display_name,
      profile_bio: normalized.profile_bio,
      profile_picture_url: normalized.profile_picture_url,
      follower_count: normalized.follower_count ?? account.follower_count,
      following_count: normalized.following_count,
      engagement_rate: normalized.engagement_rate,
      is_verified: normalized.is_verified,
      sync_status: normalized.sync_status,
      sync_source: normalized.sync_source,
      sync_error: normalized.sync_error,
      last_synced_at: normalized.last_synced_at,
      metrics_source: normalized.metrics_source,
      metrics_last_synced_at: normalized.metrics_last_synced_at,
    })
    .eq("id", account.id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  if (process.env.APIFY_TOKEN && enrichment.sync_status === "pending_api") {
    try {
      const { enrichAndPersistPlatformAvatar } = await import(
        "@/lib/performance/metrics-collector/persist"
      );
      await enrichAndPersistPlatformAvatar(supabase, {
        influencerId: account.influencer_id,
        platform,
        logSkips: false,
      });
    } catch {
      // Apify avatar enrichment is best-effort.
    }
  }

  return { ok: true, message: "Enrichment completed." };
}
