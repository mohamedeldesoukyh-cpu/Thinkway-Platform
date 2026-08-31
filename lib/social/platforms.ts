export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "snapchat"
  | "twitter"
  | "linkedin"
  | "facebook";

export const ENRICHABLE_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
  "twitter",
];

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  facebook: "Facebook",
};

export const PLATFORM_SHORT_LABELS: Record<SocialPlatform, string> = {
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  snapchat: "SC",
  twitter: "X",
  linkedin: "IN",
  facebook: "FB",
};

/**
 * Type-guard for already-canonical keys only (`"snapchat"`, not `"Snapchat"`).
 * For untrusted / mixed-case input use {@link resolveDiscoveryPlatform} or
 * `normalizeSocialPlatform` from `@/lib/social/normalize-platform`.
 */
export function isSocialPlatform(value: string): value is SocialPlatform {
  return value in PLATFORM_LABELS;
}

/**
 * Case/alias aliases → canonical lowercase platform. Only non-identity aliases
 * live here; exact canonical values (instagram, tiktok, …) pass through via
 * `isSocialPlatform`, so the canonical list is never duplicated.
 */
const PLATFORM_ALIASES: Readonly<Record<string, SocialPlatform>> = {
  ig: "instagram",
  insta: "instagram",
  gram: "instagram",
  tt: "tiktok",
  "tik tok": "tiktok",
  yt: "youtube",
  "you tube": "youtube",
  snap: "snapchat",
  sc: "snapchat",
  x: "twitter",
  "x (twitter)": "twitter",
  tweet: "twitter",
  li: "linkedin",
  "linked in": "linkedin",
  fb: "facebook",
  meta: "facebook",
};

/**
 * Normalize any casing/alias of a platform name to its canonical enum value —
 * the platform analogue of resolveCountryCode(). "TikTok" / "tiktok" / "TIKTOK"
 * → "tiktok"; "X" / "Twitter" → "twitter"; "IG" → "instagram", etc. Returns
 * undefined for empty/unrecognized input so callers can skip the filter rather
 * than send an invalid enum value to Postgres. Reuses PLATFORM_LABELS as the
 * single source of canonical values.
 */
export function resolveDiscoveryPlatform(value?: string | null): SocialPlatform | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  if (!key) return undefined;
  if (isSocialPlatform(key)) return key;
  return PLATFORM_ALIASES[key];
}

/** Infer platform from a publication/content URL host (IG / TT / YT / …). */
export function detectSocialPlatformFromContentUrl(
  contentUrl: string | null | undefined
): SocialPlatform | null {
  const raw = contentUrl?.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
      return "youtube";
    }
    if (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.watch" ||
      host.endsWith(".fb.watch")
    ) {
      return "facebook";
    }
    if (host === "snapchat.com" || host.endsWith(".snapchat.com")) return "snapchat";
    if (host === "x.com" || host === "twitter.com" || host.endsWith(".twitter.com")) {
      return "twitter";
    }
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
    return null;
  } catch {
    return null;
  }
}

export function buildCanonicalProfileUrl(
  platform: SocialPlatform,
  username: string
): string {
  const handle = normalizeUsername(username);
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
    case "snapchat":
      return `https://www.snapchat.com/add/${handle}`;
    case "twitter":
      return `https://x.com/${handle}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${handle}`;
    case "facebook":
      if (handle.startsWith("id:")) {
        return `https://www.facebook.com/profile.php?id=${handle.slice(3)}`;
      }
      return `https://www.facebook.com/${handle}`;
    default:
      return `https://${platform}.com/${handle}`;
  }
}

export function normalizeUsername(value: string): string {
  const trimmed = value.trim().replace(/^@+/, "");
  if (trimmed.toLowerCase().startsWith("id:")) {
    return `id:${trimmed.slice(3).trim()}`;
  }
  return trimmed.toLowerCase();
}

function isFacebookHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com";
}

function isFacebookProfilePhpPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path === "/profile.php" || path.endsWith("/profile.php");
}

/**
 * Canonical URL for duplicate detection. Strips tracking query params by default,
 * but preserves Facebook `profile.php?id=` because the numeric id lives in the query string.
 */
export function normalizeProfileUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";

    if (isFacebookHost(parsed.hostname) && isFacebookProfilePhpPath(parsed.pathname)) {
      const id = parsed.searchParams.get("id")?.trim();
      parsed.search = id && /^\d+$/.test(id) ? `?id=${id}` : "";
    } else {
      parsed.search = "";
    }

    let path = parsed.pathname.replace(/\/+$/, "");
    if (!path) path = "";
    parsed.pathname = path || "/";
    return parsed.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
