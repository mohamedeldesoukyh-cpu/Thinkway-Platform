import type { MetricsPlatform } from "@/lib/performance/metrics-collector/types";
import type { MetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";

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
    default:
      return { directUrls: [profileUrl], resultsLimit: 6 };
  }
}

export function buildApifyRunInput(
  platform: MetricsPlatform | string,
  url: string
): Record<string, unknown> {
  switch (platform) {
    case "tiktok":
      return {
        postURLs: [url],
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      };
    case "facebook":
      return {
        startUrls: [{ url }],
        resultsLimit: 1,
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
