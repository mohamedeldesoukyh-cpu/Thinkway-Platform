import {
  buildCanonicalProfileUrl,
  isSocialPlatform,
  normalizeProfileUrl,
  normalizeUsername,
  resolveDiscoveryPlatform,
  type SocialPlatform,
} from "./platforms";

export type ParsedProfile = {
  platform: SocialPlatform;
  username: string;
  normalized_username: string;
  profile_url: string;
  normalized_profile_url: string;
};

type PlatformPattern = {
  platform: SocialPlatform;
  hostPattern: RegExp;
  pathPattern: RegExp;
  extractUsername: (
    pathname: string,
    segments: string[],
    url?: URL
  ) => string | null;
};

const PLATFORM_PATTERNS: PlatformPattern[] = [
  {
    platform: "instagram",
    hostPattern: /^(?:www\.)?instagram\.com$/i,
    pathPattern: /^\/([^/?#]+)\/?$/i,
    extractUsername: (_p, segments) => {
      const reserved = new Set([
        "p",
        "reel",
        "reels",
        "stories",
        "explore",
        "accounts",
        "direct",
      ]);
      const user = segments[0];
      if (!user || reserved.has(user.toLowerCase())) return null;
      return user;
    },
  },
  {
    platform: "tiktok",
    hostPattern: /^(?:www\.)?tiktok\.com$/i,
    pathPattern: /^\/@([^/?#]+)\/?$/i,
    extractUsername: (_p, segments) => segments[0]?.replace(/^@/, "") ?? null,
  },
  {
    platform: "youtube",
    hostPattern: /^(?:www\.)?youtube\.com$/i,
    pathPattern: /^\/(?:@|c\/|channel\/|user\/)([^/?#]+)\/?$/i,
    extractUsername: (pathname) => {
      const handleMatch = pathname.match(/^\/@([^/?#]+)/i);
      if (handleMatch) return handleMatch[1];
      const cMatch = pathname.match(/^\/c\/([^/?#]+)/i);
      if (cMatch) return cMatch[1];
      const channelMatch = pathname.match(/^\/channel\/([^/?#]+)/i);
      if (channelMatch) return channelMatch[1];
      const userMatch = pathname.match(/^\/user\/([^/?#]+)/i);
      if (userMatch) return userMatch[1];
      return null;
    },
  },
  {
    platform: "snapchat",
    hostPattern: /^(?:www\.)?snapchat\.com$/i,
    pathPattern: /^\/add\/([^/?#]+)\/?$/i,
    extractUsername: (_p, segments) => segments[1] ?? segments[0] ?? null,
  },
  {
    platform: "twitter",
    hostPattern: /^(?:www\.)?(?:twitter|x)\.com$/i,
    pathPattern: /^\/([^/?#]+)\/?$/i,
    extractUsername: (_p, segments) => {
      const reserved = new Set(["home", "explore", "notifications", "messages", "i"]);
      const user = segments[0];
      if (!user || reserved.has(user.toLowerCase())) return null;
      return user;
    },
  },
  {
    platform: "facebook",
    hostPattern: /^(?:www\.|m\.)?(?:facebook\.com|fb\.com)$/i,
    pathPattern: /^\/(?:[^/?#]+(?:\/[^/?#]+)*)\/?$/i,
    extractUsername: (pathname, segments, url) =>
      extractFacebookUsername(pathname, segments, url),
  },
];

const FACEBOOK_RESERVED_SEGMENTS = new Set([
  "watch",
  "reel",
  "reels",
  "video",
  "videos",
  "photo",
  "photos",
  "story",
  "stories",
  "share",
  "sharer",
  "groups",
  "events",
  "marketplace",
  "gaming",
  "login",
  "help",
  "privacy",
  "policies",
  "ads",
  "business",
  "lite",
  "dialog",
  "plugins",
  "hashtag",
  "live",
  "media",
  "pg",
  "notes",
  "recover",
]);

function extractFacebookUsername(
  pathname: string,
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
    return slug && !FACEBOOK_RESERVED_SEGMENTS.has(slug.toLowerCase()) ? slug : null;
  }

  const user = segments[0];
  if (!user || FACEBOOK_RESERVED_SEGMENTS.has(user.toLowerCase())) return null;
  if (user.endsWith(".php")) return null;
  if (pathname.includes("/posts/") || pathname.includes("/videos/")) return null;
  return user;
}

function parseFromUrl(raw: string): ParsedProfile | null {
  let url: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    url = new URL(withProtocol.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const segments = pathname.split("/").filter(Boolean);

  for (const pattern of PLATFORM_PATTERNS) {
    if (!pattern.hostPattern.test(host)) continue;
    const username = pattern.extractUsername(pathname, segments, url);
    if (!username) continue;

    const normalized_username = normalizeUsername(username);
    const profile_url =
      pattern.platform === "facebook" && normalized_username.startsWith("id:")
        ? `https://www.facebook.com/profile.php?id=${normalized_username.slice(3)}`
        : buildCanonicalProfileUrl(pattern.platform, normalized_username);

    return {
      platform: pattern.platform,
      username: username.replace(/^@+/, ""),
      normalized_username,
      profile_url,
      normalized_profile_url: normalizeProfileUrl(profile_url),
    };
  }

  return null;
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
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromUrl = parseFromUrl(trimmed);
  if (fromUrl) return fromUrl;

  return parseFromHandle(trimmed, platformHint);
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
