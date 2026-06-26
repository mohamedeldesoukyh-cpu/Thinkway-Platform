import type { MetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { pickApifyAuthorAvatarUrl } from "@/lib/performance/apify-author-avatar";
import { pickApifyAuthorFollowerCount } from "@/lib/performance/apify-author-followers";
import { pickApifyPreviewImageUrl } from "@/lib/performance/apify-preview-image";
import {
  apifyActorIdForPlatform,
  buildApifyRunInput,
} from "@/lib/performance/metrics-collector/providers/apify-input";
import { extractPublicationContentFromApifyRow } from "@/lib/performance/metrics-collector/extract-publication-content";
import { mapApifyPayloadToMetrics } from "@/lib/performance/metrics-collector/providers/apify-mapper";
import { extractPublicationDateFromProviderRow } from "@/lib/performance/metrics-collector/extract-publication-date";
import {
  normalizedContentToStorageFields,
} from "@/lib/performance/content-normalizer";
import type { PublicationContent } from "@/lib/performance/metrics-collector/types";
import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";

type Ctx = {
  publication: { content_url: string | null };
  platform: string;
  contentUrl: string | null;
  env: Pick<
    MetricsCollectorEnv,
    | "apifyToken"
    | "apifyInstagramActorId"
    | "apifyTikTokActorId"
    | "apifyFacebookActorId"
    | "apifyYouTubeActorId"
    | "apifySnapchatActorId"
  >;
};

export async function tryApifyProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.env.apifyToken) {
    return {
      provider: "apify",
      available: false,
      skippedReason: "APIFY_TOKEN not configured.",
    };
  }

  const url = ctx.contentUrl ?? ctx.publication.content_url;
  if (!url) {
    return {
      provider: "apify",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
    };
  }

  const actorId = apifyActorIdForPlatform(ctx.platform, ctx.env);
  if (!actorId) {
    return {
      provider: "apify",
      available: false,
      skippedReason:
        ctx.platform === "snapchat"
          ? "APIFY_SNAPCHAT_ACTOR_ID not configured."
          : "Apify actor id not configured.",
    };
  }

  const input = buildApifyRunInput(ctx.platform, url);

  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${ctx.env.apifyToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(120_000),
    }
  );

  if (!runResponse.ok) {
    return {
      provider: "apify",
      available: true,
      error: `Apify HTTP ${runResponse.status}`,
      errorCode: "apify_http_error",
      requestPayload: { actorId, platform: ctx.platform, input },
    };
  }

  const items = (await runResponse.json()) as unknown[];
  const payload = items[0];
  const row =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const metrics = mapApifyPayloadToMetrics(ctx.platform, payload);
  const previewImageUrl = pickApifyPreviewImageUrl(payload);
  const authorAvatarUrl = pickApifyAuthorAvatarUrl(ctx.platform, payload);
  const authorFollowerCount = pickApifyAuthorFollowerCount(ctx.platform, payload);
  const publicationDate = extractPublicationDateFromProviderRow(row);
  const publicationContent = buildApifyPublicationContent(ctx.platform, row, payload);

  if (!metrics) {
    const row =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null;
    const apifyError =
      row?.errorDescription ?? row?.error ?? row?.message ?? "Apify returned no usable metrics.";

    return {
      provider: "apify",
      available: true,
      error: String(apifyError),
      errorCode: row?.error ? "apify_item_error" : "apify_empty",
      requestPayload: { actorId, platform: ctx.platform, input },
      responseSummary: row
        ? { keys: Object.keys(row), error: row.error ?? null }
        : { itemCount: items.length },
    };
  }

  return {
    provider: "apify",
    available: true,
    metrics,
    publicationContent,
    publicationDate,
    complete: Boolean(metrics.views || metrics.likes || metrics.comments),
    requestPayload: { actorId, platform: ctx.platform, input },
    responseSummary: {
      itemCount: items.length,
      previewImageUrl,
      authorAvatarUrl,
      authorFollowerCount,
      publicationDate,
      publicationContent: publicationContent
        ? {
            caption: Boolean(publicationContent.caption),
            hashtag_count: publicationContent.hashtag_count,
            mention_count: publicationContent.mention_count,
          }
        : null,
      fields: Object.keys(metrics).filter(
        (key) => metrics[key as keyof typeof metrics] != null
      ),
    },
  };
}

function buildApifyPublicationContent(
  platform: string,
  row: Record<string, unknown> | null,
  payload: unknown
): PublicationContent | null {
  const extracted = extractPublicationContentFromApifyRow(platform, payload);
  if (!extracted) return null;

  const storage = normalizedContentToStorageFields(extracted);
  const hashtagsFromProvider = hasProviderHashtags(row);
  const mentionsFromProvider = hasProviderMentions(row);

  return {
    ...storage,
    caption_source: "sync",
    hashtags_source: hashtagsFromProvider ? "sync" : "derived",
    mentions_source: mentionsFromProvider ? "sync" : "derived",
  };
}

function hasProviderHashtags(row: Record<string, unknown> | null): boolean {
  if (!row) return false;
  const hashtags = row.hashtags;
  if (Array.isArray(hashtags) && hashtags.length > 0) return true;
  const challenges = row.challenges;
  if (Array.isArray(challenges) && challenges.length > 0) return true;
  const textExtra = row.textExtra;
  return (
    Array.isArray(textExtra) &&
    textExtra.some((item) => item && typeof item === "object" && (item as { type?: string }).type === "hashtag")
  );
}

function hasProviderMentions(row: Record<string, unknown> | null): boolean {
  if (!row) return false;
  const mentions = row.mentions;
  if (Array.isArray(mentions) && mentions.length > 0) return true;
  const detailedMentions = row.detailedMentions;
  if (Array.isArray(detailedMentions) && detailedMentions.length > 0) return true;
  const textExtra = row.textExtra;
  if (
    Array.isArray(textExtra) &&
    textExtra.some((item) => item && typeof item === "object" && (item as { type?: string }).type === "user")
  ) {
    return true;
  }
  if (typeof row.ownerUsername === "string" && row.ownerUsername.trim().length > 0) return true;
  const authorMeta = row.authorMeta;
  return (
    authorMeta != null &&
    typeof authorMeta === "object" &&
    typeof (authorMeta as { name?: unknown }).name === "string" &&
    ((authorMeta as { name: string }).name).trim().length > 0
  );
}
