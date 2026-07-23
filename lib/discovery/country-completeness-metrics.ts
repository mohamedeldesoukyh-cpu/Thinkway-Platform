/**
 * Operational metrics for Discovery country completeness / enrichment backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CountryCompletenessMetrics = {
  activeInfluencers: number;
  withCountry: number;
  missingCountry: number;
  /** 0–100 */
  countryCompletenessPercent: number;
  /** Creators stuck awaiting Instagram profile-details stage. */
  awaitingProfileDetails: number;
  /**
   * Offline Apify dataset exports missing country on influencer + platform.
   * Primary repair backlog for country coverage.
   */
  profileEnrichmentBacklog: number;
};

const OFFLINE_NOTES = "%Apify dataset export (offline)%";

export async function getCountryCompletenessMetrics(
  supabase: SupabaseClient
): Promise<CountryCompletenessMetrics> {
  const [
    activeRes,
    withCountryRes,
    awaitingRes,
    offlineMissingCountryRes,
  ] = await Promise.all([
    supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .not("country_code", "is", null),
    supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("enrichment_status", "awaiting_profile_details"),
    // Offline imports with null influencer country (profile enrichment backlog).
    supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("country_code", null)
      .ilike("notes", OFFLINE_NOTES),
  ]);

  if (activeRes.error) throw new Error(activeRes.error.message);
  if (withCountryRes.error) throw new Error(withCountryRes.error.message);
  if (awaitingRes.error) throw new Error(awaitingRes.error.message);
  if (offlineMissingCountryRes.error) {
    throw new Error(offlineMissingCountryRes.error.message);
  }

  const activeInfluencers = activeRes.count ?? 0;
  const withCountry = withCountryRes.count ?? 0;
  const missingCountry = Math.max(0, activeInfluencers - withCountry);
  const countryCompletenessPercent =
    activeInfluencers > 0
      ? Math.round((withCountry / activeInfluencers) * 1000) / 10
      : 100;

  return {
    activeInfluencers,
    withCountry,
    missingCountry,
    countryCompletenessPercent,
    awaitingProfileDetails: awaitingRes.count ?? 0,
    profileEnrichmentBacklog: offlineMissingCountryRes.count ?? 0,
  };
}
