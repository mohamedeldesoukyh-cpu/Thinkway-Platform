import {
  buildCanonicalProfileUrl,
  detectSocialPlatformFromContentUrl,
  isSocialPlatform,
  normalizeProfileUrl,
  normalizeUsername,
  resolveDiscoveryPlatform,
  type SocialPlatform,
} from "./platforms";
import { isFacebookReservedPathSegment } from "@/lib/social/facebook-reserved-segments";

export type ParsedProfile = {
  platform: SocialPlatform;
  username: string;
  normalized_username: string;
  profile_url: string;
  normalized_profile_url: string;
};

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

const YOUTUBE_RESERVED = new Set([
  "watch",
  "shorts",
  "feed",
  "results",
  "playlist",
  "live",
  "gaming",
  "embed",
  "redirect",
  "account",
  "premium",
  "channel",
  "c",
  "user",
  "hashtag",
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

const SNAPCHAT_RESERVED = new Set([
  "spotlight",
  "discover",
  "lens",
  "add",
  "p",
  "t",
]);

const TIKTOK_RESERVED = new Set([
  "foryou",
  "following",
  "search",
  "live",
  "tag",
  "music",
  "effect",
  "discover",
  "video",
  "photo",
  "t",
]);

const SOCIAL_URL_RE =
  /(?:https?:\/\/)?(?:(?:www|m|vm|vt|web|mobile|l|lm|music)\.)?(?:instagram\.com|instagr\.am|tiktok\.com|youtube\.com|youtu\.be|snapchat\.com|facebook\.com|fb\.com|twitter\.com|x\.com)\/[^\s,;<>\u060C\uFF0C]+/gi;

function sanitizePasteToken(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u2060\u200E\u200F]/g, "")
    .replace(/^[<(\[]+/, "")
    .replace(/[>)\].,]+$/g, "")
    .trim();
}

function unwrapRedirectProfileUrl(raw: string): string {
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol.trim());
    for (const key of ["u", "q", "url", "target"]) {
      const nested = url.searchParams.get(key)?.trim();
      if (!nested) continue;
      if (detectSocialPlatformFromContentUrl(nested)) return nested;
    }
  } catch {
    // ignore
  }
  return raw;
}

function extractProfileUsername(
  platform: SocialPlatform,
  pathname: string,
  segments: string[],
  url: URL
): string | null {
  switch (platform) {
    case "instagram": {
      const user = segments[0];
      if (!user || INSTAGRAM_RESERVED.has(user.toLowerCase())) return null;
      return user;
    }
    case "tiktok": {
      const at = segments.find((segment) => segment.startsWith("@"));
      if (at) return at.replace(/^@+/, "");
      const first = segments[0]?.replace(/^@+/, "") ?? "";
      if (!first || TIKTOK_RESERVED.has(first.toLowerCase())) return null;
      return null;
    }
    case "youtube": {
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (host === "youtu.be") return null;
      const handleMatch = pathname.match(/^\/@([^/?#]+)/i);
      if (handleMatch) return handleMatch[1];
      if (segments[0] === "c" || segments[0] === "user" || segments[0] === "channel") {
        return segments[1] ?? null;
      }
      const first = segments[0];
      if (!first || YOUTUBE_RESERVED.has(first.toLowerCase())) return null;
      return first;
    }
    case "snapchat": {
      if (segments[0] === "add") return segments[1] ?? null;
      if (segments[0]?.startsWith("@")) return segments[0].replace(/^@+/, "");
      const first = segments[0];
      if (!first || SNAPCHAT_RESERVED.has(first.toLowerCase())) return null;
      return first;
    }
    case "twitter": {
      const user = segments[0];
      if (!user || TWITTER_RESERVED.has(user.toLowerCase())) return null;
      return user;
    }
    case "facebook": {
      return extractFacebookUsername(segments, url);
    }
    default:
      return null;
  }
}

function extractFacebookUsername(
  segments: string[],
  url?: URL
): string | null {
  if (segments[0] === "profile.php") {
    const id = url?.searchParams.get("id")?.trim();
    return id && /^\d+$/.test(id) ? `id:${id}` : null;
  }

  if (segments[0] === "people" && segments.length >= 3) {
    const id = segments[segments.length - 1]?.trim();
    return id && /^\d+$/.test(id) ? `id:${id}` : null;
  }

  if (segments[0] === "pages" && segments.length >= 2) {
    const slug = segments[1]?.trim();
    return slug && !isFacebookReservedPathSegment(slug) ? slug : null;
  }

  const user = segments[0];
  if (!user || isFacebookReservedPathSegment(user)) return null;
  if (user.endsWith(".php")) return null;
  return user;
}

function parseFromUrl(raw: string): ParsedProfile | null {
  const unwrapped = unwrapRedirectProfileUrl(raw);
  let url: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(unwrapped)
      ? unwrapped
      : `https://${unwrapped}`;
    url = new URL(withProtocol.trim());
  } catch {
    return null;
  }

  const platform = detectSocialPlatformFromContentUrl(url.toString());
  if (!platform || !isSocialPlatform(platform)) return null;

  const pathname = url.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const username = extractProfileUsername(platform, pathname, segments, url);
  if (!username) return null;

  const normalized_username = normalizeUsername(username);
  if (!normalized_username) return null;

  const profile_url =
    platform === "facebook" && normalized_username.startsWith("id:")
      ? `https://www.facebook.com/profile.php?id=${normalized_username.slice(3)}`
      : buildCanonicalProfileUrl(platform, normalized_username);

  return {
    platform,
    username: username.replace(/^@+/, ""),
    normalized_username,
    profile_url,
    normalized_profile_url: normalizeProfileUrl(profile_url),
  };
}

function parseFromHandle(raw: string, platformHint?: SocialPlatform): ParsedProfile | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("@") && trimmed.includes("/")) {
    return null;
  }

  // Bare tokens without @ are ambiguous (taxonomy, person names). Only treat as a
  // handle when the user typed @… or when a platform is explicitly known.
  if (!trimmed.startsWith("@") && !platformHint) {
    return null;
  }

  const username = trimmed.replace(/^@+/, "").trim();
  if (!username || username.includes(" ")) return null;
  if (username.startsWith("#")) return null;

  const platform = platformHint ?? "instagram";
  if (!isSocialPlatform(platform)) return null;

  const normalized_username = normalizeUsername(username);
  const profile_url = buildCanonicalProfileUrl(platform, normalized_username);

  return {
    platform,
    username,
    normalized_username,
    profile_url,
    normalized_profile_url: normalizeProfileUrl(profile_url),
  };
}

export function parseProfileInput(
  input: string,
  platformHint?: SocialPlatform
): ParsedProfile | null {
  const trimmed = sanitizePasteToken(input);
  if (!trimmed) return null;

  const fromUrl = parseFromUrl(trimmed);
  if (fromUrl) return fromUrl;

  return parseFromHandle(trimmed, platformHint);
}

function coalesceWrappedProfileUrls(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    if (prev && /\/@$/.test(prev) && /^@?[\w.]+$/.test(token)) {
      out[out.length - 1] = `${prev}${token.replace(/^@/, "")}`;
      continue;
    }
    out.push(token);
  }
  return out;
}

/** Split pasted creator links / handles (newlines, commas, semicolons, whitespace). */
export function splitProfileInputTokens(raw: string): string[] {
  const cleaned = raw
    .replace(/[\u200B-\u200D\uFEFF\u2060\u200E\u200F]/g, "")
    .replace(/[\u060C\uFF0C]/g, ",");

  const extracted: string[] = [];
  const remainder = cleaned.replace(SOCIAL_URL_RE, (match) => {
    extracted.push(sanitizePasteToken(match));
    return "\n";
  });

  const leftover = remainder
    .split(/[\s,;]+/)
    .map((token) => sanitizePasteToken(token))
    .filter((token) => token.length > 0);

  return coalesceWrappedProfileUrls(
    [...extracted, ...leftover].filter((token) => token.length > 0)
  );
}

export type ParsedProfileListItem = ParsedProfile & { raw: string };

export type ParsedProfileInputList = {
  parsed: ParsedProfileListItem[];
  invalid: string[];
};

/**
 * Parse many pasted profile URLs or @handles. Duplicate platform+username
 * pairs in the same paste are collapsed (first wins).
 */
export function parseProfileInputList(
  raw: string,
  platformHint?: SocialPlatform
): ParsedProfileInputList {
  const parsed: ParsedProfileListItem[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of splitProfileInputTokens(raw)) {
    const result = parseProfileInput(token, platformHint);
    if (!result) {
      invalid.push(token);
      continue;
    }
    const key = `${result.platform}:${result.normalized_username}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push({ ...result, raw: token });
  }

  return { parsed, invalid };
}

export function resolvePlatformAccountFields(input: {
  profile_url?: string;
  username?: string;
  platform?: string;
}): ParsedProfile | null {
  if (input.profile_url?.trim()) {
    const parsed = parseProfileInput(input.profile_url);
    if (parsed) return parsed;
  }

  const platform = resolveDiscoveryPlatform(input.platform);
  if (input.username?.trim() && platform) {
    return parseFromHandle(input.username, platform);
  }

  return null;
}
