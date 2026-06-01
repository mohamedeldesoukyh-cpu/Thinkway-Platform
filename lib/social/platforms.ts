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

export function isSocialPlatform(value: string): value is SocialPlatform {
  return value in PLATFORM_LABELS;
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
      return `https://www.facebook.com/${handle}`;
    default:
      return `https://${platform}.com/${handle}`;
  }
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function normalizeProfileUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.search = "";
    let path = parsed.pathname.replace(/\/+$/, "");
    if (!path) path = "";
    parsed.pathname = path || "/";
    return parsed.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
