export type InstagramContentKind =
  | "post"
  | "reel"
  | "story"
  | "highlight"
  | "profile"
  | "unknown";

function parseInstagramPath(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return [];
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return parsed.pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

/** Classify an Instagram permalink for metrics eligibility. */
export function classifyInstagramContentUrl(url: string): InstagramContentKind {
  const segments = parseInstagramPath(url);
  if (segments.length === 0) return "unknown";

  if (segments[0] === "stories") {
    return segments[1] === "highlights" ? "highlight" : "story";
  }
  if (segments[0] === "p" && segments[1]) return "post";
  if ((segments[0] === "reel" || segments[0] === "reels") && segments[1]) return "reel";
  if (segments[0] === "tv" && segments[1]) return "reel";
  if (segments.length === 1) return "profile";

  return "unknown";
}

/** Public post/reel URLs that Apify and other providers can scrape. */
export function instagramUrlSupportsPublicMetrics(kind: InstagramContentKind): boolean {
  return kind === "post" || kind === "reel";
}

export function instagramMetricsUnsupportedReason(kind: InstagramContentKind): string | null {
  switch (kind) {
    case "highlight":
      return "Story highlight URLs cannot be synced for metrics. Paste the reel or post URL instead.";
    case "story":
      return "Instagram story URLs cannot be synced for metrics. Use a permanent post or reel URL.";
    case "profile":
      return "Profile URLs cannot be synced for metrics. Paste the post or reel URL.";
    case "unknown":
      return "This Instagram URL format is not supported for automated metrics collection.";
    default:
      return null;
  }
}

/** Validate a publication URL before insert or metrics collection. */
export function validateInstagramPublicationUrl(
  publicationType: string | null | undefined,
  url: string
): string | null {
  const kind = classifyInstagramContentUrl(url);
  const unsupported = instagramMetricsUnsupportedReason(kind);
  if (unsupported) return unsupported;

  const type = (publicationType ?? "").trim().toLowerCase();
  if (type === "instagram_story" && kind !== "story") {
    return "Publication type is Instagram story, but the URL is not a story link.";
  }
  if ((type === "instagram_post" || type === "instagram_reel") && kind === "story") {
    return "Story URLs cannot be synced for metrics. Use a post or reel URL.";
  }

  return null;
}
