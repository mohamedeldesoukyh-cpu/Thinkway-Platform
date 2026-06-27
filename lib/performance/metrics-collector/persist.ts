import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { filterWritePayload } from "@/lib/campaigns/campaign-publications-schema";
import { getCampaignPublicationsSchema } from "@/lib/campaigns/campaign-publications-schema-runtime";
import { deriveCalculatedMetrics } from "@/lib/campaigns/performance-calculations";
import { isSocialPlatform } from "@/lib/social/platforms";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";
import type { SocialPlatform } from "@/lib/social/platforms";
import {
  buildErAuditMessage,
  metricsPayloadChanged,
  shouldWriteErAuditLog,
  type ErAuditTrigger,
} from "@/lib/performance/engagement-rate-audit";
import type { EngagementRateMethod } from "@/lib/performance/engagement-rate-engine";
import {
  buildReachAuditMessage,
  shouldWriteReachAuditLog,
  type ReachAuditTrigger,
} from "@/lib/performance/reach-audit";
import type { ImpressionsSource } from "@/lib/performance/impressions-forecast-engine";
import type { ReachSource } from "@/lib/performance/reach-forecast-engine";
import {
  confidenceForCollectedMetrics,
  confidenceForProvider,
} from "@/lib/performance/metrics-collector/confidence";
import { computeNextRefreshAt } from "@/lib/performance/metrics-collector/schedule-next-refresh";
import {
  computeEngagements,
  hasAnyMetric,
  mergeCollectedMetrics,
  metricsRefreshStatusFor,
  sanitizeMetricValue,
  storedMetricsFromPublication,
  storedReachContextFromPublication,
  storedImpressionsContextFromPublication,
} from "@/lib/performance/metrics-collector/merge-metrics";
import {
  isUsableAvatarUrl,
  normalizeAvatarSource,
  shouldSyncPlatformAvatar,
} from "@/lib/performance/avatar-sync-policy";
import {
  isAvatarUrlAllowedForPlatform,
  resolvePublicationEffectivePlatform,
} from "@/lib/performance/creator-avatar";
import { logMetricsQueueEvent } from "@/lib/performance/metrics-collector/metrics-queue-log";
import type {
  CollectionOutcome,
  CollectedMetrics,
  MetricsProviderId,
  MetricsRefreshStatus,
  ProviderAttemptResult,
  PublicationContent,
  PublicationForCollection,
} from "@/lib/performance/metrics-collector/types";

export async function writeSyncLog(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    provider: MetricsProviderId;
    attemptOrder: number;
    status: string;
    metricsRefreshStatus?: MetricsRefreshStatus;
    message?: string;
    errorCode?: string;
    error?: string | null;
    metricsSnapshot?: Partial<CollectedMetrics>;
    triggeredBy: string;
    completed?: boolean;
    durationMs?: number;
    requestPayload?: Record<string, unknown>;
    responseSummary?: Record<string, unknown>;
    previousEr?: number | null;
    newEr?: number | null;
    previousMethod?: string | null;
    newMethod?: string | null;
  }
) {
  await supabase.from("publication_metric_sync_logs").insert({
    publication_id: input.publicationId,
    campaign_header_id: input.campaignHeaderId,
    status: input.status,
    metrics_refresh_status: input.metricsRefreshStatus ?? null,
    provider: input.provider,
    attempt_order: input.attemptOrder,
    message: input.message ?? null,
    error_code: input.errorCode ?? null,
    error: input.error ?? null,
    metrics_snapshot: input.metricsSnapshot ?? null,
    triggered_by: input.triggeredBy,
    completed_at: input.completed ? new Date().toISOString() : null,
    duration_ms: input.durationMs ?? null,
    request_payload: input.requestPayload ?? null,
    response_summary: input.responseSummary ?? null,
    previous_er: input.previousEr ?? null,
    new_er: input.newEr ?? null,
    previous_method: input.previousMethod ?? null,
    new_method: input.newMethod ?? null,
  } as never);
}

export async function writeReachSourceChangeLog(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    message: string;
    triggeredBy: ReachAuditTrigger;
    metricsRefreshStatus?: MetricsRefreshStatus;
    previousReach: number | null;
    newReach: number | null;
    previousSource: ReachSource | null;
    newSource: ReachSource | null;
    forecastReach?: number | null;
    metricsSnapshot?: Partial<CollectedMetrics>;
    sourceProvider?: MetricsProviderId | null;
  }
) {
  await writeSyncLog(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignHeaderId,
    provider: "engagement_engine",
    attemptOrder: 0,
    status: "reach_source_changed",
    metricsRefreshStatus: input.metricsRefreshStatus,
    message: input.message,
    metricsSnapshot: input.metricsSnapshot,
    triggeredBy: input.triggeredBy,
    completed: true,
    responseSummary: {
      reach_audit: true,
      previous_reach: input.previousReach,
      new_reach: input.newReach,
      old_source: input.previousSource,
      new_source: input.newSource,
      old_value: input.previousReach,
      new_value: input.newReach,
      forecast_reach: input.forecastReach ?? null,
      source_provider: input.sourceProvider ?? null,
    },
  });
}
export async function writeErRecalculationLog(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    message: string;
    triggeredBy: ErAuditTrigger;
    metricsRefreshStatus?: MetricsRefreshStatus;
    previousEr: number | null;
    newEr: number | null;
    previousMethod: EngagementRateMethod | null;
    newMethod: EngagementRateMethod;
    metricsSnapshot?: Partial<CollectedMetrics>;
    sourceProvider?: MetricsProviderId | null;
  }
) {
  await writeSyncLog(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignHeaderId,
    provider: "engagement_engine",
    attemptOrder: 0,
    status: "er_recalculated",
    metricsRefreshStatus: input.metricsRefreshStatus,
    message: input.message,
    metricsSnapshot: input.metricsSnapshot,
    triggeredBy: input.triggeredBy,
    completed: true,
    previousEr: input.previousEr,
    newEr: input.newEr,
    previousMethod: input.previousMethod,
    newMethod: input.newMethod,
    responseSummary: {
      previous_er: input.previousEr,
      new_er: input.newEr,
      previous_method: input.previousMethod,
      new_method: input.newMethod,
      source_provider: input.sourceProvider ?? null,
    },
  });
}

export async function loadPublicationEngagementContext(
  supabase: SupabaseClient,
  input: { publicationId: string; campaignHeaderId: string }
): Promise<{
  influencer_id: string | null;
  platform: string | null;
  effective_platform: string | null;
  publication_type: string | null;
  followers: number | null;
  engagement_rate_method: EngagementRateMethod | null;
  metrics_provider: string | null;
  reach_source: ReachSource | null;
  actual_reach: number | null;
  forecast_reach: number | null;
  impressions_source: ImpressionsSource | null;
  actual_impressions: number | null;
  forecast_impressions: number | null;
}> {
  const { data: pub } = await supabase
    .from("campaign_publications")
    .select(
      "influencer_id, platform, publication_type, content_url, engagement_rate_method, metrics_provider, reach_source, actual_reach, forecast_reach, reach, impressions_source, actual_impressions, forecast_impressions, impressions"
    )
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId)
    .maybeSingle();

  const effectivePlatform = pub
    ? resolvePublicationEffectivePlatform({
        platform: pub.platform,
        publication_type: pub.publication_type,
        content_url: pub.content_url,
      })
    : "unknown";

  let followers: number | null = null;
  if (pub?.influencer_id && effectivePlatform !== "unknown") {
    const { data: accounts } = await supabase
      .from("influencer_platform_accounts")
      .select("follower_count, platform")
      .eq("influencer_id", pub.influencer_id);

    const account = (accounts ?? []).find(
      (row) => canonicalPlatformKey(row.platform ?? "") === effectivePlatform
    );
    followers = account?.follower_count ?? null;
  }

  return {
    influencer_id: pub?.influencer_id ?? null,
    platform: pub?.platform ?? null,
    effective_platform: effectivePlatform !== "unknown" ? effectivePlatform : null,
    publication_type: pub?.publication_type ?? null,
    followers,
    engagement_rate_method: (pub?.engagement_rate_method as EngagementRateMethod) ?? null,
    metrics_provider: pub?.metrics_provider ?? null,
    reach_source: (pub?.reach_source as ReachSource) ?? null,
    actual_reach: pub?.actual_reach ?? null,
    forecast_reach: pub?.forecast_reach ?? null,
    impressions_source: (pub?.impressions_source as ImpressionsSource) ?? null,
    actual_impressions: pub?.actual_impressions ?? null,
    forecast_impressions: pub?.forecast_impressions ?? null,
  };
}

export type SyncCreatorFollowersResult =
  | { synced: true; followerCount: number; source: "apify" | "open_graph" }
  | { synced: false; reason: string; followerCount: number | null };

/**
 * Fill missing platform-account follower_count from Apify author metadata or profile enrichment.
 * Skips rows with manual metric overrides or an existing follower count.
 */
export async function syncCreatorFollowersIfMissing(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform: string;
    followerCountFromProvider?: number | null;
    profileUrl?: string | null;
    username?: string | null;
    logSkips?: boolean;
  }
): Promise<SyncCreatorFollowersResult> {
  const logSkips = input.logSkips !== false;
  const platformKey = canonicalPlatformKey(input.platform);
  if (!platformKey || platformKey === "unknown" || !isSocialPlatform(platformKey)) {
    return { synced: false, reason: "invalid_platform", followerCount: null };
  }

  const { data: accounts, error: loadError } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, handle, username, profile_url, follower_count, metrics_is_manual_override"
    )
    .eq("influencer_id", input.influencerId);

  if (loadError) {
    return { synced: false, reason: "db_load_error", followerCount: null };
  }

  const account = (accounts ?? []).find(
    (row) => canonicalPlatformKey(row.platform ?? "") === platformKey
  );
  if (!account) {
    return { synced: false, reason: "no_platform_account", followerCount: null };
  }
  if (account.metrics_is_manual_override) {
    return { synced: false, reason: "manual_override", followerCount: account.follower_count };
  }
  if (account.follower_count != null && account.follower_count > 0) {
    return { synced: false, reason: "already_set", followerCount: account.follower_count };
  }

  let followerCount = sanitizeMetricValue(input.followerCountFromProvider);
  let source: "apify" | "open_graph" | null =
    followerCount != null ? "apify" : null;

  const profileUrl = input.profileUrl?.trim() || account.profile_url?.trim() || null;
  const username =
    input.username?.trim() ||
    account.handle?.trim() ||
    account.username?.trim() ||
    null;

  if (followerCount == null && profileUrl && username && isSocialPlatform(platformKey)) {
    try {
      const enrichment = await enrichCreatorProfile({
        platform: platformKey as SocialPlatform,
        username,
        profile_url: profileUrl,
      });
      followerCount = sanitizeMetricValue(enrichment.follower_count);
      if (followerCount != null) {
        source = "open_graph";
      }
    } catch (error) {
      if (logSkips) {
        console.warn(
          `[follower-sync] enrichment failed influencer=${input.influencerId} platform=${platformKey}`,
          error
        );
      }
    }
  }

  if (followerCount == null || followerCount <= 0 || !source) {
    return { synced: false, reason: "no_follower_data", followerCount: null };
  }

  const syncedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("influencer_platform_accounts")
    .update({
      follower_count: followerCount,
      metrics_source: "synced",
      sync_status: "synced",
      sync_source: source,
      metrics_last_synced_at: syncedAt,
      last_synced_at: syncedAt,
      updated_at: syncedAt,
    } as never)
    .eq("id", account.id);

  if (updateError) {
    if (logSkips) {
      console.warn(
        `[follower-sync] db update failed influencer=${input.influencerId} platform=${platformKey}: ${updateError.message}`
      );
    }
    return { synced: false, reason: "db_update_error", followerCount: null };
  }

  if (logSkips) {
    console.log(
      `[follower-sync] saved influencer=${input.influencerId} platform=${platformKey} followers=${followerCount} source=${source}`
    );
  }

  return { synced: true, followerCount, source };
}

export type PersistPlatformAvatarSkipReason =
  | "invalid_platform"
  | "invalid_url"
  | "cdn_platform_mismatch"
  | "no_platform_account"
  | "policy_blocked"
  | "db_update_error";

export type PersistPlatformAvatarResult =
  | { saved: true }
  | { saved: false; reason: PersistPlatformAvatarSkipReason; detail?: string };

/** Sync platform account profile picture from Apify author metadata during metrics collection. */
export async function persistInfluencerPlatformAvatar(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform: string;
    profilePictureUrl: string;
    source?: "apify" | "discovery";
    /** When true, log skip reasons (default: true). */
    logSkips?: boolean;
  }
): Promise<boolean> {
  const result = await persistInfluencerPlatformAvatarDetailed(supabase, input);
  return result.saved;
}

export async function persistInfluencerPlatformAvatarDetailed(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform: string;
    profilePictureUrl: string;
    source?: "apify" | "discovery";
    logSkips?: boolean;
  }
): Promise<PersistPlatformAvatarResult> {
  const logSkips = input.logSkips !== false;
  const platformKey = canonicalPlatformKey(input.platform);
  if (!platformKey || platformKey === "unknown" || !isSocialPlatform(platformKey)) {
    if (logSkips) {
      console.warn(
        `[avatar-sync] skip influencer=${input.influencerId} reason=invalid_platform platform=${input.platform}`
      );
    }
    return { saved: false, reason: "invalid_platform" };
  }

  const url = input.profilePictureUrl.trim();
  if (!url.startsWith("http")) {
    if (logSkips) {
      console.warn(
        `[avatar-sync] skip influencer=${input.influencerId} platform=${platformKey} reason=invalid_url`
      );
    }
    return { saved: false, reason: "invalid_url" };
  }
  if (!isAvatarUrlAllowedForPlatform(platformKey, url)) {
    if (logSkips) {
      console.warn(
        `[avatar-sync] skip influencer=${input.influencerId} platform=${platformKey} reason=cdn_platform_mismatch url=${url.slice(0, 72)}`
      );
    }
    return { saved: false, reason: "cdn_platform_mismatch" };
  }

  const { data: accounts, error: loadError } = await supabase
    .from("influencer_platform_accounts")
    .select("id, platform, profile_picture_url, avatar_source, avatar_last_synced_at")
    .eq("influencer_id", input.influencerId);

  if (loadError) {
    if (logSkips) {
      console.warn(
        `[avatar-sync] skip influencer=${input.influencerId} platform=${platformKey} reason=db_update_error detail=${loadError.message}`
      );
    }
    return { saved: false, reason: "db_update_error", detail: loadError.message };
  }

  const account = (accounts ?? []).find(
    (row) => canonicalPlatformKey(row.platform ?? "") === platformKey
  );
  if (!account) {
    if (logSkips) {
      console.warn(
        `[avatar-sync] skip influencer=${input.influencerId} platform=${platformKey} reason=no_platform_account — add matching influencer_platform_accounts row`
      );
    }
    return { saved: false, reason: "no_platform_account" };
  }

  const avatarSource = normalizeAvatarSource(
    (account as { avatar_source?: string | null }).avatar_source
  );
  const avatarLastSyncedAt =
    (account as { avatar_last_synced_at?: string | null }).avatar_last_synced_at ?? null;
  const currentUrl = account.profile_picture_url;
  const crossPlatformBlocked = Boolean(
    currentUrl?.trim() && !isAvatarUrlAllowedForPlatform(platformKey, currentUrl)
  );

  if (
    !shouldSyncPlatformAvatar(
      {
        profile_picture_url: currentUrl,
        avatar_source: avatarSource,
        avatar_last_synced_at: avatarLastSyncedAt,
      },
      Date.now(),
      { allowManualCrossPlatformRefresh: crossPlatformBlocked }
    )
  ) {
    if (logSkips) {
      console.warn(
        `[avatar-sync] skip influencer=${input.influencerId} platform=${platformKey} reason=policy_blocked source=${avatarSource} hasUrl=${Boolean(currentUrl?.trim())}`
      );
    }
    return {
      saved: false,
      reason: "policy_blocked",
      detail: `avatar_source=${avatarSource}`,
    };
  }

  const syncedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("influencer_platform_accounts")
    .update({
      profile_picture_url: url,
      avatar_source: input.source ?? "apify",
      avatar_last_synced_at: syncedAt,
      updated_at: syncedAt,
    } as never)
    .eq("id", account.id);

  if (updateError) {
    if (logSkips) {
      console.warn(
        `[avatar-sync] skip influencer=${input.influencerId} platform=${platformKey} reason=db_update_error detail=${updateError.message}`
      );
    }
    return { saved: false, reason: "db_update_error", detail: updateError.message };
  }

  return { saved: true };
}

function profileUrlForPlatformAccount(
  platformKey: string,
  handle: string | null | undefined,
  profileUrl: string | null | undefined
): string | null {
  const explicit = profileUrl?.trim();
  if (explicit) return explicit;

  const username = handle?.trim().replace(/^@/, "");
  if (!username) return null;

  switch (platformKey) {
    case "instagram":
      return `https://www.instagram.com/${username}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${username}`;
    case "youtube":
      return `https://www.youtube.com/@${username}`;
    case "facebook":
      return `https://www.facebook.com/${username}`;
    default:
      return null;
  }
}

/**
 * Open-graph profile enrichment when Apify post payloads omit author avatars.
 * Only writes when `shouldSyncPlatformAvatar()` allows it.
 */
export async function enrichAndPersistPlatformAvatar(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform: string;
    logSkips?: boolean;
  }
): Promise<PersistPlatformAvatarResult> {
  const logSkips = input.logSkips !== false;
  const platformKey = canonicalPlatformKey(input.platform);
  if (!platformKey || platformKey === "unknown" || !isSocialPlatform(platformKey)) {
    return { saved: false, reason: "invalid_platform" };
  }

  const { data: accounts, error: loadError } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, handle, username, profile_url, profile_picture_url, avatar_source, avatar_last_synced_at"
    )
    .eq("influencer_id", input.influencerId);

  if (loadError) {
    return { saved: false, reason: "db_update_error", detail: loadError.message };
  }

  const account = (accounts ?? []).find(
    (row) => canonicalPlatformKey(row.platform ?? "") === platformKey
  );
  if (!account) {
    return { saved: false, reason: "no_platform_account" };
  }

  const avatarSource = normalizeAvatarSource(
    (account as { avatar_source?: string | null }).avatar_source
  );
  const currentUrl = account.profile_picture_url;
  const crossPlatformBlocked = Boolean(
    currentUrl?.trim() && !isAvatarUrlAllowedForPlatform(platformKey, currentUrl)
  );

  if (
    !shouldSyncPlatformAvatar(
      {
        profile_picture_url: currentUrl,
        avatar_source: avatarSource,
        avatar_last_synced_at:
          (account as { avatar_last_synced_at?: string | null }).avatar_last_synced_at ?? null,
      },
      Date.now(),
      { allowManualCrossPlatformRefresh: crossPlatformBlocked }
    )
  ) {
    return { saved: false, reason: "policy_blocked", detail: `avatar_source=${avatarSource}` };
  }

  const profileUrl = profileUrlForPlatformAccount(
    platformKey,
    account.handle ?? account.username,
    account.profile_url
  );
  const username = account.handle?.trim() || account.username?.trim() || null;
  if (!profileUrl || !username) {
    return { saved: false, reason: "invalid_url" };
  }

  try {
    const enrichment = await enrichCreatorProfile({
      platform: platformKey as SocialPlatform,
      username,
      profile_url: profileUrl,
    });
    const picture = enrichment.profile_picture_url?.trim();
    if (!picture || !isUsableAvatarUrl(picture)) {
      return { saved: false, reason: "invalid_url" };
    }
    if (!isAvatarUrlAllowedForPlatform(platformKey, picture)) {
      return { saved: false, reason: "cdn_platform_mismatch" };
    }

    return persistInfluencerPlatformAvatarDetailed(supabase, {
      influencerId: input.influencerId,
      platform: platformKey,
      profilePictureUrl: picture,
      source: "discovery",
      logSkips,
    });
  } catch (error) {
    if (logSkips) {
      console.warn(
        `[avatar-sync] enrichment failed influencer=${input.influencerId} platform=${platformKey}`,
        error
      );
    }
    return {
      saved: false,
      reason: "db_update_error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function loadPublicationStoredMetrics(
  supabase: SupabaseClient,
  input: { publicationId: string; campaignHeaderId: string }
): Promise<Partial<CollectedMetrics>> {
  const { data, error } = await supabase
    .from("campaign_publications")
    .select(
      "views, reach, actual_reach, forecast_reach, reach_source, impressions, actual_impressions, forecast_impressions, impressions_source, likes, comments, shares, saves, plays, clicks, engagements, engagement_rate, engagement_rate_method, engagement_views, engagement_likes, engagement_comments, engagement_shares"
    )
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId)
    .maybeSingle();

  if (error || !data) return {};
  return storedMetricsFromPublication(data as Record<string, unknown>);
}

export async function loadPublicationStoredContent(
  supabase: SupabaseClient,
  input: { publicationId: string; campaignHeaderId: string }
): Promise<{
  caption: string | null;
  hashtags: string | null;
  mentions: string | null;
  caption_source: string | null;
  hashtags_source: string | null;
  mentions_source: string | null;
}> {
  const { data, error } = await supabase
    .from("campaign_publications")
    .select("caption, hashtags, mentions, caption_source, hashtags_source, mentions_source")
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId)
    .maybeSingle();

  if (error || !data) {
    return {
      caption: null,
      hashtags: null,
      mentions: null,
      caption_source: null,
      hashtags_source: null,
      mentions_source: null,
    };
  }

  const row = data as Record<string, string | null>;
  return {
    caption: row.caption ?? null,
    hashtags: row.hashtags ?? null,
    mentions: row.mentions ?? null,
    caption_source: row.caption_source ?? null,
    hashtags_source: row.hashtags_source ?? null,
    mentions_source: row.mentions_source ?? null,
  };
}

function shouldOverwriteContentField(
  existingSource: string | null,
  incomingSource: PublicationContent["caption_source"]
): boolean {
  if (existingSource === "manual") return false;
  if (existingSource === "derived" && incomingSource === "sync") return true;
  if (!existingSource) return true;
  return incomingSource === "sync" || existingSource === "derived";
}

export function mergePublicationContentForPersist(
  existing: Awaited<ReturnType<typeof loadPublicationStoredContent>>,
  incoming: PublicationContent
): Partial<PublicationContent> {
  const out: Partial<PublicationContent> = {};

  if (
    incoming.caption &&
    shouldOverwriteContentField(existing.caption_source, incoming.caption_source)
  ) {
    out.caption = incoming.caption;
    out.caption_source = incoming.caption_source;
  }

  if (
    incoming.hashtags &&
    shouldOverwriteContentField(existing.hashtags_source, incoming.hashtags_source)
  ) {
    out.hashtags = incoming.hashtags;
    out.hashtags_source = incoming.hashtags_source;
    out.hashtag_count = incoming.hashtag_count;
  }

  if (
    incoming.mentions &&
    shouldOverwriteContentField(existing.mentions_source, incoming.mentions_source)
  ) {
    out.mentions = incoming.mentions;
    out.mentions_source = incoming.mentions_source;
    out.mention_count = incoming.mention_count;
  }

  return out;
}

export async function persistPublicationContent(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    content: PublicationContent;
  }
) {
  const schema = await getCampaignPublicationsSchema(supabase);
  const existing = await loadPublicationStoredContent(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignHeaderId,
  });

  const merged = mergePublicationContentForPersist(existing, input.content);
  if (Object.keys(merged).length === 0) return;

  const payload = filterWritePayload(
    {
      ...merged,
      updated_at: new Date().toISOString(),
    },
    schema.columns
  );

  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId);

  if (error) throw new Error(error.message);
}

export async function persistCollectedMetrics(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    metrics: Partial<CollectedMetrics>;
    status: MetricsRefreshStatus;
    source: MetricsProviderId | null;
    confidence: number | null;
    publication?: PublicationForCollection;
    previewImageUrl?: string | null;
    existingMetrics?: Partial<CollectedMetrics>;
    /** When true, incoming metrics replace stored values (restore automatic). */
    replaceExisting?: boolean;
    triggeredBy?: ErAuditTrigger;
    /** Platform post date from automated collection — overwrites stored date when set. */
    publicationDate?: string | null;
    /** Caption, hashtags, mentions from provider extraction. */
    publicationContent?: PublicationContent | null;
  }
) {
  const schema = await getCampaignPublicationsSchema(supabase);

  const storedBeforePersist = await loadPublicationStoredMetrics(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignHeaderId,
  });

  const engagementContext = await loadPublicationEngagementContext(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignHeaderId,
  });

  const previousEr = storedBeforePersist.engagement_rate ?? null;
  const previousMethod = engagementContext.engagement_rate_method ?? null;
  const reachContext = storedReachContextFromPublication(
    storedBeforePersist as Record<string, unknown>
  );
  const impressionsContext = storedImpressionsContextFromPublication(
    storedBeforePersist as Record<string, unknown>
  );
  const previousReachSource = reachContext.reach_source ?? engagementContext.reach_source ?? null;
  const previousReach = sanitizeMetricValue(storedBeforePersist.reach) ?? null;

  const existing =
    input.replaceExisting
      ? {}
      : (input.existingMetrics ?? storedBeforePersist);

  const manualRate =
    input.source === "manual" && input.metrics.engagement_rate != null
      ? input.metrics.engagement_rate
      : null;

  const merged = mergeCollectedMetrics(existing, input.metrics, {
    platform: engagementContext.platform,
    publication_type: engagementContext.publication_type,
    followers: engagementContext.followers,
    engagement_rate_method: engagementContext.engagement_rate_method,
    manualEngagementRate: manualRate,
    reach_source: previousReachSource,
    stored_actual_reach: reachContext.stored_actual_reach ?? engagementContext.actual_reach,
    stored_forecast_reach: reachContext.stored_forecast_reach ?? engagementContext.forecast_reach,
    stored_reach: reachContext.stored_reach ?? sanitizeMetricValue(storedBeforePersist.reach),
    metrics_source: input.source,
    impressions_source:
      impressionsContext.impressions_source ?? engagementContext.impressions_source ?? null,
    stored_actual_impressions:
      impressionsContext.stored_actual_impressions ?? engagementContext.actual_impressions,
    stored_forecast_impressions:
      impressionsContext.stored_forecast_impressions ?? engagementContext.forecast_impressions,
    stored_impressions:
      impressionsContext.stored_impressions ?? sanitizeMetricValue(storedBeforePersist.impressions),
  });

  const engagementRateMethod = (merged.engagement_rate_method ??
    "unknown") as EngagementRateMethod;
  const refreshStatus =
    input.status === "completed" || input.status === "partial"
      ? metricsRefreshStatusFor(merged, {
          platform: engagementContext.platform,
          publication_type: engagementContext.publication_type,
        })
      : input.status;

  const sanitized = {
    views: sanitizeMetricValue(merged.views),
    reach: sanitizeMetricValue(merged.reach),
    impressions: sanitizeMetricValue(merged.impressions),
    likes: sanitizeMetricValue(merged.likes),
    comments: sanitizeMetricValue(merged.comments),
    shares: sanitizeMetricValue(merged.shares),
    saves: sanitizeMetricValue(merged.saves),
    plays: sanitizeMetricValue(merged.plays),
    clicks: sanitizeMetricValue(merged.clicks),
    engagements: sanitizeMetricValue(merged.engagements) ?? computeEngagements(merged),
    engagement_rate: merged.engagement_rate ?? null,
    engagement_rate_method: engagementRateMethod,
  };

  const derived = deriveCalculatedMetrics({
    impressions: sanitized.impressions,
    reach: sanitized.reach,
    views: sanitized.views,
    likes: sanitized.likes,
    comments: sanitized.comments,
    shares: sanitized.shares,
    saves: sanitized.saves,
    clicks: sanitized.clicks,
    cost: null,
  });

  const nextRefreshAt =
    input.publication &&
    computeNextRefreshAt({
      publicationStatus: input.publication.status ?? "published",
      publicationDate:
        input.publicationDate ?? input.publication.publication_date ?? null,
      createdAt: input.publication.created_at ?? new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    });

  const payload = filterWritePayload(
    {
      views: sanitized.views,
      reach: sanitized.reach,
      reach_source: merged.reach_source ?? null,
      actual_reach: merged.actual_reach ?? null,
      forecast_reach: merged.forecast_reach ?? null,
      impressions: sanitized.impressions,
      impressions_source: merged.impressions_source ?? null,
      actual_impressions: merged.actual_impressions ?? null,
      forecast_impressions: merged.forecast_impressions ?? null,
      likes: sanitized.likes,
      comments: sanitized.comments,
      shares: sanitized.shares,
      saves: sanitized.saves,
      engagements: sanitized.engagements,
      engagement_rate: sanitized.engagement_rate,
      engagement_rate_method: sanitized.engagement_rate_method,
      plays: sanitized.plays,
      clicks: sanitized.clicks,
      view_rate: derived.view_rate,
      cpm: derived.cpm,
      cpv: derived.cpv,
      cpe: derived.cpe,
      cpc: derived.cpc,
      engagement_views: sanitized.views,
      engagement_likes: sanitized.likes,
      engagement_comments: sanitized.comments,
      engagement_shares: sanitized.shares,
      metrics_refresh_status: refreshStatus,
      metrics_refresh_attempted_at: new Date().toISOString(),
      metrics_next_refresh_at: nextRefreshAt?.toISOString() ?? null,
      metrics_collection_source: input.source,
      metrics_provider:
        input.source === "manual" || input.source === "manual_import"
          ? "manual"
          : input.source,
      metrics_confidence: input.confidence ?? confidenceForProvider(input.source),
      last_synced_at: new Date().toISOString(),
      sync_status: refreshStatus,
      sync_source: input.source ?? "manual",
      api_sync_status: refreshStatus,
      detection_source: input.source ?? "manual",
      ...(input.publicationDate ? { publication_date: input.publicationDate } : {}),
      ...(input.previewImageUrl ? { thumbnail_url: input.previewImageUrl } : {}),
      updated_at: new Date().toISOString(),
    },
    schema.columns
  );

  if (input.publicationDate && !("publication_date" in payload)) {
    console.warn(
      `[metrics-collector] publication_date not written — column missing in schema for publication ${input.publicationId}`
    );
  }

  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId);

  if (error) throw new Error(error.message);

  if (input.publicationContent) {
    await persistPublicationContent(supabase, {
      publicationId: input.publicationId,
      campaignHeaderId: input.campaignHeaderId,
      content: input.publicationContent,
    });
  }

  const triggeredBy =
    input.triggeredBy ??
    (input.source === "manual"
      ? "manual"
      : input.source === "manual_import"
        ? "manual_import"
        : "metrics_collected");

  const metricsChanged = metricsPayloadChanged(
    storedBeforePersist as unknown as Record<string, number | null | undefined>,
    sanitized as unknown as Record<string, number | null | undefined>
  );

  const nextEr = sanitized.engagement_rate;
  const shouldAudit = shouldWriteErAuditLog({
    triggeredBy,
    previous: {
      engagement_rate: previousEr,
      engagement_rate_method: previousMethod,
    },
    next: {
      engagement_rate: nextEr,
      engagement_rate_method: engagementRateMethod,
    },
    metricsChanged,
  });

  if (shouldAudit) {
    await writeErRecalculationLog(supabase, {
      publicationId: input.publicationId,
      campaignHeaderId: input.campaignHeaderId,
      message: buildErAuditMessage({
        triggeredBy,
        previous: {
          engagement_rate: previousEr,
          engagement_rate_method: previousMethod,
        },
        next: {
          engagement_rate: nextEr,
          engagement_rate_method: engagementRateMethod,
        },
      }),
      triggeredBy,
      metricsRefreshStatus: refreshStatus,
      previousEr,
      newEr: nextEr,
      previousMethod,
      newMethod: engagementRateMethod,
      metricsSnapshot: {
        engagements: sanitized.engagements,
        engagement_rate: sanitized.engagement_rate,
        views: sanitized.views,
        reach: sanitized.reach,
        likes: sanitized.likes,
        comments: sanitized.comments,
      },
      sourceProvider: input.source,
    });
  }

  const nextReachSource = merged.reach_source ?? null;
  const nextReach = sanitized.reach;
  const shouldReachAudit = shouldWriteReachAuditLog({
    triggeredBy,
    previous: {
      reach: previousReach,
      reach_source: previousReachSource,
      forecast_reach: reachContext.stored_forecast_reach ?? engagementContext.forecast_reach ?? null,
    },
    next: {
      reach: nextReach,
      reach_source: nextReachSource,
      forecast_reach: merged.forecast_reach ?? null,
    },
    metricsChanged,
  });

  if (shouldReachAudit) {
    await writeReachSourceChangeLog(supabase, {
      publicationId: input.publicationId,
      campaignHeaderId: input.campaignHeaderId,
      message: buildReachAuditMessage({
        triggeredBy,
        previous: {
          reach: previousReach,
          reach_source: previousReachSource,
          forecast_reach: reachContext.stored_forecast_reach ?? engagementContext.forecast_reach ?? null,
        },
        next: {
          reach: nextReach,
          reach_source: nextReachSource,
          forecast_reach: merged.forecast_reach ?? null,
        },
      }),
      triggeredBy,
      metricsRefreshStatus: refreshStatus,
      previousReach,
      newReach: nextReach,
      previousSource: previousReachSource,
      newSource: nextReachSource,
      forecastReach: merged.forecast_reach ?? null,
      metricsSnapshot: {
        reach: sanitized.reach,
        views: sanitized.views,
        likes: sanitized.likes,
        comments: sanitized.comments,
      },
      sourceProvider: input.source,
    });
  }
}

export async function markPublicationRefreshStatus(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    status: MetricsRefreshStatus;
  }
) {
  const schema = await getCampaignPublicationsSchema(supabase);
  const payload = filterWritePayload(
    {
      metrics_refresh_status: input.status,
      metrics_refresh_attempted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    schema.columns
  );

  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId);

  if (error) {
    logMetricsQueueEvent("STATUS_UPDATED", {
      publicationId: input.publicationId,
      status: input.status,
      error: error.message,
    });
    throw new Error(
      `Failed to update metrics_refresh_status for publication ${input.publicationId}: ${error.message}`
    );
  }

  logMetricsQueueEvent("STATUS_UPDATED", {
    publicationId: input.publicationId,
    status: input.status,
  });
}

export async function queuePublicationForMetrics(
  supabase: SupabaseClient,
  input: { publicationId: string; campaignHeaderId: string }
) {
  const schema = await getCampaignPublicationsSchema(supabase);
  const payload = filterWritePayload(
    {
      metrics_refresh_status: "queued",
      updated_at: new Date().toISOString(),
    },
    schema.columns
  );

  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId);

  if (error) throw new Error(error.message);
}

export function outcomeFromAttempts(
  publicationId: string,
  merged: Partial<CollectedMetrics> & { engagement_rate_method?: EngagementRateMethod },
  attempts: ProviderAttemptResult[],
  winningSource: MetricsProviderId | null,
  winningConfidence: number | null,
  context?: { platform?: string | null; publication_type?: string | null }
): CollectionOutcome {
  const hasMetrics = hasAnyMetric(merged);
  const refreshStatus = metricsRefreshStatusFor(merged, context);

  let status: MetricsRefreshStatus = "manual_required";
  let message = "No automated provider returned metrics — use manual import.";

  if (hasMetrics && winningSource) {
    status = refreshStatus;
    message =
      refreshStatus === "completed"
        ? `Metrics collected via ${winningSource}.`
        : `Partial metrics from ${winningSource} — views, likes, and comments unavailable.`;
  } else if (attempts.some((a) => a.available && a.error)) {
    status = "failed";
    message = "All configured providers failed — manual import required for client report.";
  }

  const confidence =
    confidenceForCollectedMetrics(winningSource, merged) ??
    winningConfidence ??
    confidenceForProvider(winningSource);

  return {
    publicationId,
    status,
    source: winningSource,
    confidence,
    metrics: merged,
    attempts,
    message,
  };
}
