/**
 * Staged enrichment / commercial readiness for Discovery imports.
 *
 * Offline Instagram dataset exports often arrive as post-only rows. Those must
 * not be promoted to `enriched` until profile-details identity fields are
 * collected (or explicitly marked unavailable).
 */

import type { CreatorEnrichmentStatus } from "@/lib/creator-enrichment/types";
import { mergeCountryCodes } from "@/lib/creators/country-inference";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

/** Logical enrichment stage (ops language; maps onto creator_enrichment_status). */
export type EnrichmentStage =
  | "awaiting_profile_details"
  | "profile_identity_complete"
  | "commercially_ready";

export type CountryAvailability = "present" | "unavailable" | "unknown";

export type ProfileIdentitySignals = {
  platform: string;
  followers?: number | null;
  audienceCountry?: string | null;
  countryCode?: string | null;
  countryCodes?: string[] | null;
  /** True when Instagram profile-details rows were present or live backfill succeeded. */
  profileDetailsSatisfied: boolean;
  /**
   * After a successful profile-details fetch, country may still be absent on the
   * provider payload — mark unavailable so commercial readiness can proceed.
   */
  countryAvailability?: CountryAvailability;
};

export type OfflineImportStatusInput = ProfileIdentitySignals & {
  /** Optional explicit import country from the operator/CSV. */
  importCountryCode?: string | null;
};

/** Required identity fields for commercial readiness. */
export function hasResolvedCountry(input: {
  audienceCountry?: string | null;
  countryCode?: string | null;
  countryCodes?: string[] | null;
}): boolean {
  return (
    mergeCountryCodes(
      input.countryCodes,
      input.countryCode,
      input.audienceCountry
    ).length > 0
  );
}

export function hasUsableFollowerCount(followers?: number | null): boolean {
  return typeof followers === "number" && Number.isFinite(followers) && followers > 0;
}

export function isCountryExplicitlyUnavailable(
  availability?: CountryAvailability
): boolean {
  return availability === "unavailable";
}

/**
 * Profile identity is commercially ready when:
 * - profile-details stage satisfied (followers or explicit profile rows), AND
 * - country present OR explicitly unavailable after a details attempt.
 */
export function isProfileIdentityCommerciallyReady(
  signals: ProfileIdentitySignals
): boolean {
  if (!signals.profileDetailsSatisfied) return false;

  if (hasResolvedCountry(signals)) return true;

  return isCountryExplicitlyUnavailable(signals.countryAvailability);
}

export function resolveEnrichmentStage(
  signals: ProfileIdentitySignals
): EnrichmentStage {
  if (isProfileIdentityCommerciallyReady(signals)) {
    return "commercially_ready";
  }
  if (signals.profileDetailsSatisfied && hasResolvedCountry(signals)) {
    return "profile_identity_complete";
  }
  return "awaiting_profile_details";
}

/**
 * Status written by offline Apify dataset import / finalize paths.
 * Never returns `enriched` unless profile identity is commercially ready.
 */
export function resolveOfflineImportEnrichmentStatus(
  input: OfflineImportStatusInput
): CreatorEnrichmentStatus {
  const platform = canonicalPlatformKey(input.platform) || input.platform;
  const countryCode =
    input.importCountryCode?.trim() || input.countryCode || null;

  const signals: ProfileIdentitySignals = {
    ...input,
    platform,
    countryCode,
  };

  if (isProfileIdentityCommerciallyReady(signals)) {
    return "enriched";
  }

  // Non-Instagram offline imports without full identity still land as partial
  // rather than falsely enriched — Instagram is the profile-details bottleneck.
  if (platform !== "instagram") {
    return hasResolvedCountry(signals) || hasUsableFollowerCount(input.followers)
      ? "partial"
      : "awaiting_profile_details";
  }

  return "awaiting_profile_details";
}

/** True when stored status means commercially ready (final enrichment state). */
export function isFinalEnrichmentStatus(status: CreatorEnrichmentStatus): boolean {
  return status === "enriched" || status === "skipped";
}

/**
 * After a live enrichment attempt, decide whether country should be marked
 * unavailable so the creator can leave the profile-details backlog.
 */
export function resolveCountryAvailabilityAfterDetails(input: {
  profileDetailsSatisfied: boolean;
  hasCountry: boolean;
  previousAvailability?: CountryAvailability;
}): CountryAvailability {
  if (input.hasCountry) return "present";
  if (input.previousAvailability === "unavailable") return "unavailable";
  if (input.profileDetailsSatisfied) return "unavailable";
  return "unknown";
}

/** Gate: never promote offline Instagram import to final enriched without identity. */
export function assertOfflineImportMayPromoteToEnriched(
  input: OfflineImportStatusInput
): boolean {
  return resolveOfflineImportEnrichmentStatus(input) === "enriched";
}
