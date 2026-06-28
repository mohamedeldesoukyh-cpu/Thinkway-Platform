/** Avatar origin on influencer_platform_accounts.profile_picture_url */
export type AvatarSource = "manual" | "apify" | "discovery" | "uploaded";

export const AVATAR_SYNC_STALE_MS = 30 * 24 * 60 * 60 * 1000;

const PLACEHOLDER_HOST_FRAGMENTS = [
  "ui-avatars.com",
  "gravatar.com/avatar",
  "placehold.it",
  "placeholder.com",
  "via.placeholder.com",
  "dummyimage.com",
  "picsum.photos",
];

const PLACEHOLDER_PATH_FRAGMENTS = [
  "/default_avatar",
  "/default-avatar",
  "/anonymous",
  "/static/images/default",
  "default_user",
  "default-user",
  "avatar_default",
  "avatar-default",
  "profile_default",
  "profile-default",
  "no_avatar",
  "no-avatar",
  "missing_avatar",
  "blank_avatar",
];

const PLACEHOLDER_QUERY_FRAGMENTS = ["default_avatar", "placeholder", "no_image", "noimage"];

/** Instagram static default avatar asset — renders as the IG logo, not a creator photo. */
function isInstagramStaticPlaceholderUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (lower.includes("static.cdninstagram.com") && lower.includes("/rsrc.php")) return true;
  if (lower.includes("r0fbimurk8v.png")) return true;
  return false;
}

export function isEmptyAvatarUrl(url: string | null | undefined): boolean {
  return !url?.trim();
}

export function isPlaceholderAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();

  if (isInstagramStaticPlaceholderUrl(trimmed)) return true;

  if (lower.includes("data:image/svg") && lower.includes("placeholder")) return true;

  for (const fragment of PLACEHOLDER_HOST_FRAGMENTS) {
    if (lower.includes(fragment)) return true;
  }

  try {
    const parsed = new URL(trimmed);
    const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();
    for (const fragment of PLACEHOLDER_PATH_FRAGMENTS) {
      if (pathAndQuery.includes(fragment)) return true;
    }
    for (const fragment of PLACEHOLDER_QUERY_FRAGMENTS) {
      if (parsed.search.toLowerCase().includes(fragment)) return true;
    }
  } catch {
    return true;
  }

  return false;
}

/** Lightweight broken URL heuristics — no network HEAD. */
export function isBrokenAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (!/^https?:\/\//i.test(trimmed)) return true;

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname || parsed.hostname === "localhost") return true;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  } catch {
    return true;
  }

  return isPlaceholderAvatarUrl(trimmed);
}

export function isAvatarUrlNeedsRefresh(url: string | null | undefined): boolean {
  if (isEmptyAvatarUrl(url)) return true;
  return isBrokenAvatarUrl(url!);
}

/** True when URL is non-empty and safe to show or persist as a creator photo. */
export function isUsableAvatarUrl(url: string | null | undefined): boolean {
  return !isAvatarUrlNeedsRefresh(url);
}

function parseSyncedAt(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function isAvatarSyncStale(lastSyncedAt: string | null | undefined, nowMs = Date.now()): boolean {
  const syncedMs = parseSyncedAt(lastSyncedAt);
  if (syncedMs == null) return true;
  return nowMs - syncedMs > AVATAR_SYNC_STALE_MS;
}

export type PlatformAvatarAccount = {
  profile_picture_url: string | null;
  avatar_source: AvatarSource | string | null;
  avatar_last_synced_at: string | null;
};

/**
 * Whether an automated sync may write profile_picture_url.
 * Never overwrites manual uploads; allows first fill when URL is empty.
 * Re-syncs apify avatars after 30 days.
 */
export function shouldSyncPlatformAvatar(
  account: PlatformAvatarAccount,
  nowMs = Date.now(),
  options?: { allowManualCrossPlatformRefresh?: boolean }
): boolean {
  const source = (account.avatar_source ?? "manual") as AvatarSource;
  const url = account.profile_picture_url;
  const needsRefresh = isAvatarUrlNeedsRefresh(url);
  const stale = isAvatarSyncStale(account.avatar_last_synced_at, nowMs);

  if (source === "manual") {
    if (isEmptyAvatarUrl(url)) return true;
    if (options?.allowManualCrossPlatformRefresh) return true;
    // Broken/placeholder manual URLs (e.g. migration default) may be replaced by Apify.
    if (needsRefresh) return true;
    return false;
  }

  if (needsRefresh) return true;

  if (source === "apify" && stale) return true;

  if ((source === "discovery" || source === "uploaded") && stale) return true;

  return false;
}

/**
 * Whether persist may write profile_picture_url (includes Discovery force refresh).
 */
export function shouldPersistPlatformAvatar(
  account: PlatformAvatarAccount,
  nowMs = Date.now(),
  options?: { forceSync?: boolean; allowManualCrossPlatformRefresh?: boolean }
): boolean {
  if (options?.forceSync) {
    const source = normalizeAvatarSource(account.avatar_source);
    if (source !== "manual") return true;
    return isAvatarUrlNeedsRefresh(account.profile_picture_url);
  }
  return shouldSyncPlatformAvatar(account, nowMs, options);
}

export function normalizeAvatarSource(value: string | null | undefined): AvatarSource {
  switch (value) {
    case "apify":
    case "discovery":
    case "uploaded":
    case "manual":
      return value;
    default:
      return "manual";
  }
}
