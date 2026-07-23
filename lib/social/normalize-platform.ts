/**
 * Single write/read boundary for social platform identity.
 *
 * Untrusted strings (DB rows, CSV imports, UI forms, API payloads) MUST pass
 * through {@link normalizeSocialPlatform} before:
 *  - persisting to influencer_platform_accounts / discovered_profiles
 *  - gating Apify / enrichment
 *  - comparing platform equality
 *
 * `isSocialPlatform` is a type-guard for already-canonical values only.
 */

import {
  isSocialPlatform,
  resolveDiscoveryPlatform,
  type SocialPlatform,
} from "./platforms";

/** Canonical lowercase SocialPlatform, or null when unrecognized. */
export function normalizeSocialPlatform(
  value?: string | null
): SocialPlatform | null {
  return resolveDiscoveryPlatform(value) ?? null;
}

/**
 * Type-guard after normalization. Prefer this over raw `isSocialPlatform(raw)`
 * when the string may be mixed-case or an alias ("Snapchat", "SC", "IG").
 */
export function isNormalizedSocialPlatform(
  value?: string | null
): value is SocialPlatform {
  return normalizeSocialPlatform(value) != null;
}

/** Assert/normalize for persistence — throws when platform cannot be resolved. */
export function requireSocialPlatform(
  value: string | null | undefined,
  context = "platform"
): SocialPlatform {
  const platform = normalizeSocialPlatform(value);
  if (!platform) {
    throw new Error(`Unsupported ${context}: ${value ?? "(empty)"}`);
  }
  return platform;
}

/** Safe equality after canonicalization (handles Snapchat vs snapchat). */
export function platformsEqual(a?: string | null, b?: string | null): boolean {
  const left = normalizeSocialPlatform(a);
  const right = normalizeSocialPlatform(b);
  return left != null && left === right;
}

/** Re-export type-guard for already-canonical values. */
export { isSocialPlatform };
export type { SocialPlatform };
