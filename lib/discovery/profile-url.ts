import type { UnifiedCreatorPlatform } from "@/lib/creators/types";
import {
  buildCanonicalProfileUrl,
  isSocialPlatform,
  normalizeUsername,
  PLATFORM_LABELS,
} from "@/lib/social/platforms";

export type ProfileUrlSource = {
  platform?: string | null;
  handle?: string | null;
  profile_url?: string | null;
};

/** Human-readable platform label for tooltips and UI copy. */
export function platformDisplayLabel(platform: string | null | undefined): string {
  const key = platform?.trim().toLowerCase() ?? "";
  if (key && isSocialPlatform(key)) {
    return PLATFORM_LABELS[key];
  }
  if (!key) return "Social";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Tooltip copy for external profile links, e.g. "Open on Instagram". */
export function openOnPlatformTooltip(platform: string | null | undefined): string {
  return `Open on ${platformDisplayLabel(platform)}`;
}

/** Tooltip when a display name is available: "Open Jane Doe on Instagram". */
export function profileLinkTooltip(
  displayName: string,
  platform: string | null | undefined
): string {
  const label = platformDisplayLabel(platform);
  return displayName.trim() ? `Open ${displayName.trim()} on ${label}` : openOnPlatformTooltip(platform);
}

export function pickPrimaryPlatformAccount<
  T extends { platform: string; is_primary?: boolean | null },
>(accounts: T[] | null | undefined): T | null {
  if (!accounts?.length) return null;
  return accounts.find((account) => account.is_primary) ?? accounts[0] ?? null;
}

/**
 * Resolves the external social profile URL for a creator platform account.
 *
 * Prefers a stored `profile_url`; otherwise derives a canonical URL from the
 * platform + handle so links work even when no URL was captured at import time.
 * Returns `null` only when neither a stored URL nor a usable handle exists.
 */
export function resolveCreatorProfileUrl(source: ProfileUrlSource | null | undefined): string | null {
  if (!source) return null;

  const stored = source.profile_url?.trim();
  if (stored) return stored;

  const handle = source.handle?.trim().replace(/^@+/, "");
  if (!handle) return null;

  const platform = source.platform?.trim().toLowerCase() ?? "";
  if (platform && isSocialPlatform(platform)) {
    return buildCanonicalProfileUrl(platform, handle);
  }

  if (platform) {
    return `https://${platform}.com/${normalizeUsername(handle)}`;
  }

  return null;
}

/** Convenience wrapper for the primary (first) platform of a unified creator. */
export function resolvePrimaryProfileUrl(
  platforms: UnifiedCreatorPlatform[] | null | undefined
): string | null {
  return resolveCreatorProfileUrl(platforms?.[0]);
}
