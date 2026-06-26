import type { DetectionPlatform, MetricsPlatform, MetricsProviderId, PublicationForCollection } from "@/lib/performance/metrics-collector/types";

type ContentDetection = {
  platform: DetectionPlatform;
  mediaId: string | null;
  canonicalUrl: string | null;
};

const HOST_PLATFORM: Array<{ pattern: RegExp; platform: MetricsPlatform }> = [
  { pattern: /^(?:www\.)?instagram\.com$/i, platform: "instagram" },
  { pattern: /^(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com)$/i, platform: "tiktok" },
  { pattern: /^(?:www\.)?(?:youtube\.com|youtu\.be|m\.youtube\.com)$/i, platform: "youtube" },
  {
    pattern: /^(?:www\.)?(?:facebook\.com|m\.facebook\.com|fb\.com|fb\.watch)$/i,
    platform: "facebook",
  },
  {
    pattern: /^(?:www\.)?(?:snapchat\.com|story\.snapchat\.com)$/i,
    platform: "snapchat",
  },
];

export function normalizePublicationPlatform(
  value: string | null | undefined
): MetricsPlatform | null {
  return normalizePlatform(value);
}

function normalizePlatform(value: string | null | undefined): MetricsPlatform | null {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "ig") return "instagram";
  if (v === "yt") return "youtube";
  if (v === "fb") return "facebook";
  if (v === "sc") return "snapchat";
  if (
    v === "instagram" ||
    v === "tiktok" ||
    v === "youtube" ||
    v === "facebook" ||
    v === "snapchat"
  ) {
    return v;
  }
  return null;
}

function extractMediaId(platform: MetricsPlatform, url: URL): string | null {
  const path = url.pathname;
  const segments = path.split("/").filter(Boolean);

  switch (platform) {
    case "instagram": {
      if (segments[0] === "p" && segments[1]) return segments[1];
      if ((segments[0] === "reel" || segments[0] === "reels") && segments[1]) {
        return segments[1];
      }
      return null;
    }
    case "tiktok": {
      const videoIdx = segments.indexOf("video");
      if (videoIdx >= 0 && segments[videoIdx + 1]) return segments[videoIdx + 1];
      if (segments.length >= 2 && /^\d+$/.test(segments[segments.length - 1]!)) {
        return segments[segments.length - 1]!;
      }
      return null;
    }
    case "youtube": {
      if (url.hostname.includes("youtu.be")) return segments[0] ?? null;
      if (segments[0] === "shorts" && segments[1]) return segments[1];
      if (segments[0] === "embed" && segments[1]) return segments[1];
      return url.searchParams.get("v");
    }
    case "facebook": {
      if (url.hostname.includes("fb.watch") && segments[0]) return segments[0];
      if (segments[0] === "reel" && segments[1]) return segments[1];
      if (segments[0] === "watch") return url.searchParams.get("v");
      const storyIdx = segments.indexOf("posts");
      if (storyIdx >= 0 && segments[storyIdx + 1]) return segments[storyIdx + 1];
      const videosIdx = segments.indexOf("videos");
      if (videosIdx >= 0 && segments[videosIdx + 1]) return segments[videosIdx + 1];
      return url.searchParams.get("v") ?? url.searchParams.get("story_fbid");
    }
    case "snapchat": {
      if (segments[0] === "spotlight" && segments[1]) return segments[1];
      if (segments[0] === "p" && segments[1]) return segments[1];
      return segments[segments.length - 1] ?? null;
    }
    default:
      return null;
  }
}

export function detectPublicationPlatform(
  publication: PublicationForCollection
): ContentDetection {
  const fromField = normalizePlatform(publication.platform);
  const rawUrl = publication.content_url?.trim();

  if (!rawUrl) {
    return {
      platform: fromField ?? "unknown",
      mediaId: publication.external_media_id,
      canonicalUrl: null,
    };
  }

  try {
    const url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    const host = url.hostname.toLowerCase();

    for (const entry of HOST_PLATFORM) {
      if (!entry.pattern.test(host)) continue;
      return {
        platform: entry.platform,
        mediaId: publication.external_media_id ?? extractMediaId(entry.platform, url),
        canonicalUrl: url.toString(),
      };
    }
  } catch {
    // fall through
  }

  return {
    platform: fromField ?? "unknown",
    mediaId: publication.external_media_id,
    canonicalUrl: rawUrl,
  };
}

export function providerChainForPlatform(platform: DetectionPlatform | MetricsPlatform): MetricsProviderId[] {
  switch (platform) {
    case "instagram":
      return ["apify", "meta_graph_api", "brightdata", "playwright"];
    case "tiktok":
      return ["tiktok_api", "apify", "playwright"];
    case "youtube":
      return ["youtube_data_api", "apify", "youtube_public_metadata"];
    case "facebook":
      return ["facebook_graph_api", "apify", "brightdata", "playwright"];
    case "snapchat":
      return ["snapchat_api", "apify", "playwright"];
    default:
      return ["apify", "playwright"];
  }
}