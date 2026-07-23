/**
 * Single source of truth for persisting influencer `country_code` + `country_codes`.
 *
 * Every creator write/update path (enrichment, import, promote, vendor forms,
 * backfill) MUST use helpers from this module — do not write country columns directly.
 */

import { resolveCountryCode } from "@/lib/creators/country-code";

import {
  buildCreatorCountryWriteFromApifyProfile,
  buildInfluencerCountryWrite,
  inferCountriesFromProfileSignals,
  mergeCountryCodes,
  type CreatorCountryWriteFromProfileInput,
  type InfluencerCountryWrite,
} from "@/lib/creators/country-inference";

export type {
  CreatorCountryWriteFromProfileInput,
  InfluencerCountryWrite,
} from "@/lib/creators/country-inference";

export {
  applyInfluencerCountryBrowseFilter,
  buildCreatorCountryWriteFromApifyProfile,
  buildInfluencerCountryWrite,
  extractCountryCodesFromFlagEmojis,
  extractCountryCodesFromText,
  inferCountriesFromProfileSignals,
  mergeCountryCodes,
  resolveCreatorCountryCodes,
} from "@/lib/creators/country-inference";

export {
  backfillInfluencerCountryCodes,
  collectCountryCodesFromExistingData,
  hasAnyStoredCountrySignal,
  type CollectedCountryCodes,
  type CountryBackfillOptions,
  type CountryBackfillReport,
  type CountryBackfillSource,
} from "@/lib/creators/country-backfill";

export { buildCountryWriteFromStoredSignals } from "@/lib/creators/country-backfill";

export type InfluencerCountryWriteInput = {
  existingCountryCode?: string | null;
  existingCountryCodes?: string[] | null;
  incomingCodes?: Array<string[] | string | null | undefined>;
  /** Manual edits — force this ISO code as primary when it resolves in the merged set. */
  preferredPrimary?: string | null;
  /**
   * When true (default), automated pipelines keep the existing primary code if it
   * remains in the merged country list — sparse re-enrichment cannot demote it.
   */
  preserveExistingPrimary?: boolean;
};

/** Merge-only country write used by every persistence path. */
export function persistInfluencerCountryFields(
  input: InfluencerCountryWriteInput
): InfluencerCountryWrite | null {
  return buildInfluencerCountryWrite(input);
}

/** Apify enrichment + import profile normalization. */
export function persistCountryFromApifyProfile(
  input: CreatorCountryWriteFromProfileInput & InfluencerCountryWriteInput
): InfluencerCountryWrite | null {
  return buildCreatorCountryWriteFromApifyProfile(input);
}

/** CSV / spreadsheet import rows. */
export function persistCountryFromImportRow(input: {
  existingCountryCode?: string | null;
  existingCountryCodes?: string[] | null;
  country?: string | null;
  displayName?: string | null;
  preferredPrimary?: string | null;
}): InfluencerCountryWrite | null {
  const resolved = resolveCountryCode(input.country ?? "");
  return buildInfluencerCountryWrite({
    existingCountryCode: input.existingCountryCode,
    existingCountryCodes: input.existingCountryCodes,
    incomingCodes: [
      resolved || null,
      inferCountriesFromProfileSignals({
        displayName: input.displayName,
      }),
    ],
    preferredPrimary: input.preferredPrimary ?? (resolved || null),
    preserveExistingPrimary: false,
  });
}

/** Promote discovered profile → influencer. */
export function persistCountryFromDiscoveredProfile(input: {
  country_code?: string | null;
  bio?: string | null;
  displayName?: string | null;
  city?: string | null;
}): InfluencerCountryWrite | null {
  return buildInfluencerCountryWrite({
    incomingCodes: [
      input.country_code,
      inferCountriesFromProfileSignals({
        bio: input.bio,
        displayName: input.displayName,
        city: input.city,
      }),
    ],
  });
}

/** Open-graph / pre-enrichment signals when Add Creator by URL creates a row. */
export function persistCountryFromInitialProfileSignals(input: {
  bio?: string | null;
  displayName?: string | null;
  handle?: string | null;
  audienceCountry?: string | null;
}): InfluencerCountryWrite | null {
  return buildCreatorCountryWriteFromApifyProfile({
    audienceCountry: input.audienceCountry,
    bio: input.bio,
    displayName: input.displayName,
    handle: input.handle,
  });
}

/** Spread helper for Supabase insert/update payloads. */
export function countryWritePayload(
  write: InfluencerCountryWrite | null | undefined
): Partial<InfluencerCountryWrite> {
  if (!write) return {};
  return {
    country_code: write.country_code,
    country_codes: write.country_codes,
  };
}

/** True when influencer row has no resolved country codes. */
export function influencerMissingCountryData(input: {
  country_code?: string | null;
  country_codes?: string[] | null;
}): boolean {
  return mergeCountryCodes(input.country_codes, input.country_code).length === 0;
}
