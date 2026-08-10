import type { MetricsPlatform } from "@/lib/performance/metrics-collector/types";
import type { MetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import {
  classifyFacebookContentUrl,
  facebookContentUrlKindLabel,
  isFacebookDirectContentUrl,
  isFacebookPageProfileApifyActor,
} from "@/lib/performance/metrics-collector/facebook-content-url";
import type { PublicationMetricsFailureStage } from "@/lib/performance/metrics-collector/publication-metrics-failure-stage";

/** Default publication-metrics actor: accepts direct post/reel permalinks via `postUrls`. */
export const DEFAULT_FACEBOOK_CONTENT_APIFY_ACTOR_ID =
  "clappi/facebook-posts-reels-scraper";

export function apifyActorIdForPlatform(
  platform: MetricsPlatform | string,
  env: Pick<
    MetricsCollectorEnv,
    | "apifyInstagramActorId"
    | "apifyTikTokActorId"
    | "apifyFacebookActorId"
    | "apifyYouTubeActorId"
    | "apifySnapchatActorId"
  >
): string | null {
  switch (platform) {
    case "tiktok":
      return env.apifyTikTokActorId;
    case "facebook":
      return env.apifyFacebookActorId;
    case "youtube":
      return env.apifyYouTubeActorId;
    case "snapchat":
      return env.apifySnapchatActorId;
    case "instagram":
    default:
      return env.apifyInstagramActorId;
  }
}

/** Actor for creator profile enrichment (may differ from post/content scrapers). */
export function apifyProfileActorIdForPlatform(
  platform: MetricsPlatform | string,
  env: Pick<
    MetricsCollectorEnv,
    | "apifyInstagramActorId"
    | "apifyTikTokActorId"
    | "apifyFacebookActorId"
    | "apifyFacebookProfileActorId"
    | "apifyYouTubeActorId"
    | "apifySnapchatActorId"
  >
): string | null {
  if (platform === "facebook") {
    return env.apifyFacebookProfileActorId ?? env.apifyFacebookActorId;
  }
  return apifyActorIdForPlatform(platform, env);
}

export function buildApifyProfileDetailsInput(
  platform: MetricsPlatform | string,
  profileUrl: string,
  username?: string | null
): Record<string, unknown> {
  const handle = username?.replace(/^@+/, "").trim().toLowerCase() ?? null;
  switch (platform) {
    case "instagram":
      return { directUrls: [profileUrl], resultsType: "details", resultsLimit: 1 };
    case "tiktok":
      return handle
        ? { profiles: [handle], resultsPerPage: 6, shouldDownloadVideos: false }
        : { postURLs: [profileUrl], resultsPerPage: 6 };
    case "youtube":
      return { startUrls: [{ url: profileUrl }], maxResults: 6 };
    case "facebook":
      return { startUrls: [{ url: profileUrl }] };
    case "snapchat": {
      const snapHandle = username?.replace(/^@+/, "").trim().toLowerCase();
      const usernames = [snapHandle || profileUrl].filter(Boolean);
      return { usernames };
    }
    default:
      return { directUrls: [profileUrl], resultsLimit: 6 };
  }
}

export type ApifyRunInputResolution =
  | {
      ok: true;
      input: Record<string, unknown>;
      facebookUrlKind?: string;
    }
  | {
      ok: false;
      error: string;
      errorCode: "unsupported_url";
      failureStage: PublicationMetricsFailureStage;
      facebookUrlKind?: string;
      actorInvoked: false;
    };

/**
 * Resolve Apify actor input for a publication content URL.
 * Facebook page/profile actors are refused for direct reel/post permalinks.
 */
export function resolveApifyRunInput(
  platform: MetricsPlatform | string,
  url: string,
  actorId?: string | null
): ApifyRunInputResolution {
  if (platform === "facebook") {
    const kind = classifyFacebookContentUrl(url);
    const label = facebookContentUrlKindLabel(kind);

    if (isFacebookPageProfileApifyActor(actorId) && isFacebookDirectContentUrl(url)) {
      return {
        ok: false,
        error: `${label} permalinks cannot be scraped with page/profile actor ${actorId}. Configure APIFY_FACEBOOK_ACTOR_ID to a post/reel-capable actor (default: ${DEFAULT_FACEBOOK_CONTENT_APIFY_ACTOR_ID}).`,
        errorCode: "unsupported_url",
        failureStage: "unsupported_url",
        facebookUrlKind: kind,
        actorInvoked: false,
      };
    }

    if (isFacebookPageProfileApifyActor(actorId)) {
      return {
        ok: true,
        input: { startUrls: [{ url }], resultsLimit: 1 },
        facebookUrlKind: kind,
      };
    }

    // Content actors (clappi, scrapyspider, …)
    const id = (actorId ?? "").toLowerCase();
    if (id.includes("scrapyspider/") || id.includes("facebook-post-scraper")) {
      return {
        ok: true,
        input: { urls: [url], includeCommentText: false, proxy: { useApifyProxy: true } },
        facebookUrlKind: kind,
      };
    }

    // Default content schema used by clappi/facebook-posts-reels-scraper
    return {
      ok: true,
      input: { postUrls: [url] },
      facebookUrlKind: kind,
    };
  }

  return { ok: true, input: buildApifyRunInput(platform, url) };
}

export function buildApifyRunInput(
  platform: MetricsPlatform | string,
  url: string,
  actorId?: string | null
): Record<string, unknown> {
  if (platform === "facebook") {
    const resolved = resolveApifyRunInput(platform, url, actorId);
    if (resolved.ok) return resolved.input;
    // Legacy callers that ignore resolution: still avoid pretending page startUrls work for reels.
    return { postUrls: [url] };
  }

  switch (platform) {
    case "tiktok":
      return {
        postURLs: [url],
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      };
    case "youtube":
      return {
        startUrls: [{ url }],
        maxResults: 1,
      };
    case "snapchat":
      return {
        directUrls: [url],
        resultsLimit: 1,
      };
    default:
      return {
        directUrls: [url],
        resultsLimit: 1,
      };
  }
}
