import {
  detectSocialPlatformFromContentUrl,
  normalizeUsername,
  type SocialPlatform,
} from "@/lib/social/platforms";
import { isFacebookReservedPathSegment } from "@/lib/social/facebook-reserved-segments";

const INSTAGRAM_RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "direct",
  "tv",
  "share",
]);

const TWITTER_RESERVED = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "i",
  "intent",
  "share",
  "search",
]);

/**
 * Best-effort creator handle from a publication/content URL.
 * Many IG/FB reel permalinks omit the username — returns null in those cases.
 */
export function extractHandleFromContentUrl(
  contentUrl: string | null | undefined
): { platform: SocialPlatform; handle: string } | null {
  const platform = detectSocialPlatformFromContentUrl(contentUrl);
  if (!platform || !contentUrl?.trim()) return null;

  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(contentUrl.trim()) ? contentUrl.trim() : `https://${contentUrl.trim()}`
    );
  } catch {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let raw: string | null = null;

  switch (platform) {
    case "tiktok": {
      const at = segments.find((s) => s.startsWith("@"));
      raw = at ? at.slice(1) : null;
      break;
    }
    case "instagram": {
      const first = segments[0]?.toLowerCase() ?? "";
      if (!INSTAGRAM_RESERVED.has(first)) raw = segments[0] ?? null;
      break;
    }
    case "youtube": {
      if (segments[0]?.startsWith("@")) raw = segments[0].slice(1);
      else if (segments[0] === "c" || segments[0] === "user" || segments[0] === "channel") {
        raw = segments[1] ?? null;
      }
      break;
    }
    case "facebook": {
      const first = segments[0] ?? "";
      if (!isFacebookReservedPathSegment(first) && !first.toLowerCase().endsWith(".php")) {
        raw = segments[0] ?? null;
      }
      break;
    }
    case "twitter": {
      const first = segments[0]?.toLowerCase() ?? "";
      if (!TWITTER_RESERVED.has(first) && first !== "status") {
        raw = segments[0] ?? null;
      }
      break;
    }
    case "snapchat": {
      if (segments[0] === "add") raw = segments[1] ?? null;
      break;
    }
    default:
      raw = null;
  }

  const handle = normalizeUsername(raw ?? "");
  if (!handle) return null;
  return { platform, handle };
}
