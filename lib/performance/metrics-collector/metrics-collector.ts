import type { SupabaseClient } from "@supabase/supabase-js";

import {
  confidenceForProvider,
  pickWinningProvider,
} from "@/lib/performance/metrics-collector/confidence";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import {
  detectPublicationPlatform,
  normalizePublicationPlatform,
  providerChainForPlatform,
} from "@/lib/performance/metrics-collector/detect-platform";
import {
  classifyInstagramContentUrl,
  instagramMetricsUnsupportedReason,
  instagramUrlSupportsPublicMetrics,
} from "@/lib/performance/metrics-collector/instagram-content-url";
import { resolvePublicationEffectivePlatform } from "@/lib/performance/creator-avatar";
import {
  hasAnyMetric,
  isCompleteMetrics,
  mergeCollectedMetrics,
  storedMetricsFromPublication,
  stripReachFromCollectedMetrics,
  stripImpressionsFromCollectedMetrics,
} from "@/lib/performance/metrics-collector/merge-metrics";
import {
  loadPublicationEngagementContext,
  markPublicationRefreshStatus,
  outcomeFromAttempts,
  persistCollectedMetrics,
  enrichAndPersistPlatformAvatar,
  persistInfluencerPlatformAvatarDetailed,
  syncCreatorFollowersIfMissing,
  writeSyncLog,
} from "@/lib/performance/metrics-collector/persist";
import { runProvider } from "@/lib/performance/metrics-collector/providers/registry";
import { enqueuePublicationScreenshotJob } from "@/lib/performance/screenshot-capture/queue";
import type {
  CollectionOutcome,
  CollectedMetrics,
  MetricsCollectorOptions,
  MetricsProviderId,
  PublicationContent,
  PublicationForCollection,
  ProviderAttemptResult,
} from "@/lib/performance/metrics-collector/types";

function summarizeMetricsForLog(metrics: Partial<CollectedMetrics> | undefined): string {
  if (!metrics) return "none";
  const parts: string[] = [];
  if (metrics.views != null) parts.push(`views=${metrics.views}`);
  if (metrics.likes != null) parts.push(`likes=${metrics.likes}`);
  if (metrics.comments != null) parts.push(`comments=${metrics.comments}`);
  if (metrics.engagements != null) parts.push(`engagements=${metrics.engagements}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

function attemptStatusLabel(attempt: ProviderAttemptResult): string {
  if (attempt.metrics && hasAnyMetric(attempt.metrics)) return "success";
  if (attempt.skippedReason) return "skipped";
  return "failed";
}

type PostMetricsSideEffectInput = {
  publication: PublicationForCollection;
  engagementContext: Awaited<ReturnType<typeof loadPublicationEngagementContext>>;
  resolvedPlatform: ReturnType<typeof detectPublicationPlatform>["platform"];
  apifyAuthorAvatarUrl: string | null;
  apifyAuthorFollowerCount: number | null;
  winningSource: MetricsProviderId | null;
};

function resolveAvatarPlatformForPublication(
  input: PostMetricsSideEffectInput
): ReturnType<typeof resolvePublicationEffectivePlatform> {
  const { publication, engagementContext, resolvedPlatform } = input;
  return (
    engagementContext.effective_platform ??
    (resolvedPlatform !== "unknown"
      ? resolvedPlatform
      : resolvePublicationEffectivePlatform({
          platform: publication.platform,
          publication_type: publication.publication_type,
          content_url: publication.content_url,
        }))
  );
}

async function runPostMetricsSideEffects(
  supabase: SupabaseClient,
  input: PostMetricsSideEffectInput
): Promise<void> {
  const avatarPlatform = resolveAvatarPlatformForPublication(input);
  const { publication, engagementContext, apifyAuthorAvatarUrl, apifyAuthorFollowerCount, winningSource } =
    input;

  if (engagementContext.influencer_id && engagementContext.followers == null && avatarPlatform !== "unknown") {
    try {
      await syncCreatorFollowersIfMissing(supabase, {
        influencerId: engagementContext.influencer_id,
        platform: avatarPlatform,
        followerCountFromProvider: apifyAuthorFollowerCount,
      });
    } catch (error) {
      console.warn("[metrics-collector] follower sync failed", error);
    }
  }

  if (apifyAuthorAvatarUrl && engagementContext.influencer_id && avatarPlatform !== "unknown") {
    try {
      const persistResult = await persistInfluencerPlatformAvatarDetailed(supabase, {
        influencerId: engagementContext.influencer_id,
        platform: avatarPlatform,
        profilePictureUrl: apifyAuthorAvatarUrl,
      });
      if (persistResult.saved) {
        console.log(
          `[metrics-collector] profile picture saved influencer=${engagementContext.influencer_id} platform=${avatarPlatform}`
        );
      }
    } catch (error) {
      console.warn("[metrics-collector] profile picture persist failed", error);
    }
  } else if (
    winningSource === "apify" &&
    engagementContext.influencer_id &&
    !apifyAuthorAvatarUrl &&
    avatarPlatform !== "unknown"
  ) {
    try {
      const enrichResult = await enrichAndPersistPlatformAvatar(supabase, {
        influencerId: engagementContext.influencer_id,
        platform: avatarPlatform,
      });
      if (enrichResult.saved) {
        console.log(
          `[metrics-collector] profile picture enriched influencer=${engagementContext.influencer_id} platform=${avatarPlatform}`
        );
      } else {
        console.warn(
          `[metrics-collector] Apify metrics saved but authorAvatarUrl missing publication=${publication.id} platform=${input.resolvedPlatform} — enrichment ${enrichResult.reason}`
        );
      }
    } catch (error) {
      console.warn("[metrics-collector] profile picture enrichment failed", error);
    }
  } else if (winningSource === "apify" && engagementContext.influencer_id && !apifyAuthorAvatarUrl) {
    console.warn(
      `[metrics-collector] Apify metrics saved but authorAvatarUrl missing publication=${publication.id} platform=${input.resolvedPlatform} — check actor payload fields`
    );
  }

  try {
    const { enqueued, jobId } = await enqueuePublicationScreenshotJob({
      publicationId: publication.id,
      campaignHeaderId: publication.campaign_header_id,
      triggeredBy: "metrics_collected",
    });
    if (!enqueued) {
      console.warn(
        `[metrics-collector] screenshot not enqueued publication=${publication.id} — REDIS_URL missing`
      );
    } else {
      console.log(
        `[metrics-collector] screenshot enqueued publication=${publication.id} job=${jobId ?? "n/a"}`
      );
    }
  } catch (error) {
    console.warn("[metrics-collector] screenshot enqueue failed", error);
  }
}

/**
 * Production metrics collector orchestrator.
 * detect platform → run provider chain → merge → persist best available values.
 */
export async function metricsCollector(
  supabase: SupabaseClient,
  publication: PublicationForCollection,
  options: MetricsCollectorOptions
): Promise<CollectionOutcome> {
  await markPublicationRefreshStatus(supabase, {
    publicationId: publication.id,
    campaignHeaderId: publication.campaign_header_id,
    status: "collecting",
  });

  const detection = detectPublicationPlatform(publication);
  const resolvedPlatform =
    detection.platform === "unknown"
      ? (normalizePublicationPlatform(publication.platform) ?? detection.platform)
      : detection.platform;
  const chain = providerChainForPlatform(
    resolvedPlatform === "unknown" ? "instagram" : resolvedPlatform
  );
  const env = getMetricsCollectorEnv();
  const contentUrl = detection.canonicalUrl ?? publication.content_url;

  if (resolvedPlatform === "instagram" && contentUrl) {
    const instagramKind = classifyInstagramContentUrl(contentUrl);
    if (!instagramUrlSupportsPublicMetrics(instagramKind)) {
      const reason =
        instagramMetricsUnsupportedReason(instagramKind) ??
        "Instagram URL is not supported for automated metrics collection.";
      const unsupportedAttempt: ProviderAttemptResult = {
        provider: "apify",
        available: true,
        error: reason,
        errorCode: "unsupported_url_type",
        requestPayload: { url: contentUrl, instagramContentKind: instagramKind },
      };

      await writeSyncLog(supabase, {
        publicationId: publication.id,
        campaignHeaderId: publication.campaign_header_id,
        provider: "apify",
        attemptOrder: 1,
        status: "failed",
        message: reason,
        errorCode: "unsupported_url_type",
        error: reason,
        triggeredBy: options.triggeredBy,
        completed: true,
        requestPayload: unsupportedAttempt.requestPayload,
        responseSummary: {
          success: false,
          metricsSummary: "none",
          instagramContentKind: instagramKind,
        },
      });

      await markPublicationRefreshStatus(supabase, {
        publicationId: publication.id,
        campaignHeaderId: publication.campaign_header_id,
        status: "failed",
      });

      return {
        publicationId: publication.id,
        status: "failed",
        source: null,
        confidence: null,
        metrics: {},
        attempts: [unsupportedAttempt],
        message: reason,
      };
    }
  }

  const engagementContext = await loadPublicationEngagementContext(supabase, {
    publicationId: publication.id,
    campaignHeaderId: publication.campaign_header_id,
  });

  const mergeContext = {
    platform: publication.platform,
    publication_type: publication.publication_type,
    followers: engagementContext.followers,
    engagement_rate_method: engagementContext.engagement_rate_method,
  };

  let merged: Partial<CollectedMetrics> =
    options.triggeredBy === "manual_restore_automatic"
      ? {}
      : storedMetricsFromPublication(publication as Record<string, unknown>);
  const attempts: ProviderAttemptResult[] = [];
  let winningSource: MetricsProviderId | null = null;
  let winningConfidence: number | null = null;
  let apifyPreviewImageUrl: string | null = null;
  let apifyAuthorAvatarUrl: string | null = null;
  let apifyAuthorFollowerCount: number | null = null;
  let resolvedPublicationDate: string | null = null;
  let resolvedPublicationContent: PublicationContent | null = null;

  for (let i = 0; i < chain.length; i += 1) {
    const providerId = chain[i]!;
    const attempt = await runProvider(providerId, {
      publication,
      platform: resolvedPlatform === "unknown" ? publication.platform : resolvedPlatform,
      contentUrl,
      mediaId: detection.mediaId,
      env,
      playwrightExtract: options.playwrightExtract,
    });
    attempts.push(attempt);

    const statusLabel = attemptStatusLabel(attempt);
    const metricsSummary = summarizeMetricsForLog(attempt.metrics);

    console.log(
      `[metrics-collector] publication=${publication.id} provider=${providerId} ` +
        `status=${statusLabel} durationMs=${attempt.durationMs ?? 0} metrics=${metricsSummary}`
    );

    await writeSyncLog(supabase, {
      publicationId: publication.id,
      campaignHeaderId: publication.campaign_header_id,
      provider: providerId,
      attemptOrder: i + 1,
      status: statusLabel,
      message:
        statusLabel === "success"
          ? `Metrics: ${metricsSummary}`
          : (attempt.skippedReason ?? attempt.error ?? "Provider returned no metrics."),
      errorCode: attempt.errorCode,
      error: attempt.error ?? null,
      metricsSnapshot: attempt.metrics,
      triggeredBy: options.triggeredBy,
      completed: true,
      durationMs: attempt.durationMs,
      requestPayload: attempt.requestPayload,
      responseSummary: {
        ...attempt.responseSummary,
        success: statusLabel === "success",
        metricsSummary,
      },
    });

    if (attempt.publicationDate) {
      resolvedPublicationDate = attempt.publicationDate;
    }

    if (attempt.publicationContent) {
      resolvedPublicationContent = attempt.publicationContent;
    }

    if (attempt.metrics && hasAnyMetric(attempt.metrics)) {
      merged = mergeCollectedMetrics(merged, attempt.metrics, mergeContext);
      winningSource = pickWinningProvider(
        winningSource,
        winningConfidence,
        providerId
      );
      winningConfidence = confidenceForProvider(winningSource);
    }

    if (providerId === "apify") {
      const preview = attempt.responseSummary?.previewImageUrl;
      if (typeof preview === "string" && preview.startsWith("http")) {
        apifyPreviewImageUrl = preview;
      }
      const authorAvatar = attempt.responseSummary?.authorAvatarUrl;
      if (typeof authorAvatar === "string" && authorAvatar.startsWith("http")) {
        apifyAuthorAvatarUrl = authorAvatar;
      }
      const authorFollowers = attempt.responseSummary?.authorFollowerCount;
      if (typeof authorFollowers === "number" && authorFollowers > 0) {
        apifyAuthorFollowerCount = authorFollowers;
      }
      if (!resolvedPublicationDate && attempt.publicationDate) {
        resolvedPublicationDate = attempt.publicationDate;
      }
      if (attempt.publicationContent) {
        resolvedPublicationContent = attempt.publicationContent;
      }
    }

    // Stop immediately when Apify returns metrics — do not fall through to later providers.
    if (providerId === "apify" && attempt.metrics && hasAnyMetric(attempt.metrics)) {
      break;
    }

    if (isCompleteMetrics(merged)) break;
  }

  const outcome = outcomeFromAttempts(
    publication.id,
    merged,
    attempts,
    winningSource,
    winningConfidence,
    mergeContext
  );

  if (hasAnyMetric(merged)) {
    await persistCollectedMetrics(supabase, {
      publicationId: publication.id,
      campaignHeaderId: publication.campaign_header_id,
      metrics: stripImpressionsFromCollectedMetrics(
        stripReachFromCollectedMetrics(merged)
      ),
      status: outcome.status,
      source: winningSource,
      confidence: outcome.confidence,
      publication,
      previewImageUrl: apifyPreviewImageUrl,
      replaceExisting: options.triggeredBy === "manual_restore_automatic",
      triggeredBy: options.triggeredBy,
      publicationDate: resolvedPublicationDate,
      publicationContent: resolvedPublicationContent,
    });

    void runPostMetricsSideEffects(supabase, {
      publication,
      engagementContext,
      resolvedPlatform,
      apifyAuthorAvatarUrl,
      apifyAuthorFollowerCount,
      winningSource,
    }).catch((error) => {
      console.warn("[metrics-collector] post-metrics side effects failed", error);
    });
  } else {
    await markPublicationRefreshStatus(supabase, {
      publicationId: publication.id,
      campaignHeaderId: publication.campaign_header_id,
      status: outcome.status,
    });
  }

  return outcome;
}

export async function metricsCollectorById(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    triggeredBy: MetricsCollectorOptions["triggeredBy"];
    playwrightExtract?: MetricsCollectorOptions["playwrightExtract"];
  }
): Promise<CollectionOutcome> {
  const { data, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, platform, content_url, external_media_id, publication_type, publication_date, status, created_at, views, reach, impressions, likes, comments, shares, saves, plays, clicks, engagements, engagement_rate, engagement_views, engagement_likes, engagement_comments, engagement_shares"
    )
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Publication not found.");

  return metricsCollector(supabase, data as PublicationForCollection, {
    triggeredBy: input.triggeredBy,
    playwrightExtract: input.playwrightExtract,
  });
}
