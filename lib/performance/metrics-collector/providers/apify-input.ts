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
