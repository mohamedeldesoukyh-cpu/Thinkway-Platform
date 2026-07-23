import type { SupabaseClient } from "@supabase/supabase-js";

import { parseCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { envelopeHasValue } from "@/features/creator-dna/services/field-envelope";
import {
  buildInfluencerCountryWrite,
  inferCountriesFromProfileSignals,
  mergeCountryCodes,
} from "@/lib/creators/country-inference";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import { resolveCountryCode } from "@/lib/creators/country-code";

export type CountryBackfillSource =
  | "influencer.country_code"
  | "influencer.country_codes"
  | "influencer.nationality"
  | "influencer.audience_top_countries"
  | "platform.audience_country"
  | "platform.profile_bio"
  | "platform.display_name"
  | "influencer.city"
  | "influencer.bio"
  | "discovered_profile.country_code"
  | "discovered_profile.bio"
  | "discovered_profile.city"
  | "dna.audience.country"
  | "dna.audience.countries"
  | "ipl.normalized_snapshot"
  | "creator_intelligence.audience_countries"
  | "bio_inference";

export type CollectedCountryCodes = {
  codes: string[];
  sources: CountryBackfillSource[];
};

type InfluencerBackfillRow = {
  id: string;
  display_name: string | null;
  country_code: string | null;
  country_codes: string[] | null;
  city: string | null;
  nationality: string | null;
  audience_top_countries: Array<{ code?: string; name?: string; percent?: number }> | null;
};

type PlatformBackfillRow = {
  audience_country: string | null;
  profile_bio: string | null;
  profile_display_name: string | null;
  hashtags: string[] | null;
  mentions: string[] | null;
};

type DiscoveredProfileBackfillRow = {
  country_code: string | null;
  bio: string | null;
  city: string | null;
};

function addCodesFromRaw(
  codes: string[],
  sourceSet: Set<CountryBackfillSource>,
  source: CountryBackfillSource,
  ...values: Array<string[] | string | null | undefined>
): void {
  const before = codes.length;
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const resolved = normalizeCountryCode(resolveCountryCode(item));
        if (resolved && !codes.includes(resolved)) codes.push(resolved);
      }
    } else {
      const resolved = normalizeCountryCode(resolveCountryCode(value));
      if (resolved && !codes.includes(resolved)) codes.push(resolved);
    }
  }
  if (codes.length > before) sourceSet.add(source);
}

function envelopeString(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const envelope = value as { value?: unknown };
  return typeof envelope.value === "string" ? envelope.value : null;
}

function envelopeStringArray(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const envelope = value as { value?: unknown };
  if (!Array.isArray(envelope.value)) return [];
  return envelope.value.filter((item): item is string => typeof item === "string");
}

export function collectCountryCodesFromExistingData(input: {
  influencer: InfluencerBackfillRow;
  platforms?: PlatformBackfillRow[];
  discoveredProfiles?: DiscoveredProfileBackfillRow[];
  dnaDocument?: unknown;
  iplAudienceCountries?: Array<string | null | undefined>;
  intelligenceAudienceCountries?: string[] | null;
}): CollectedCountryCodes {
  const codes: string[] = [];
  const sources = new Set<CountryBackfillSource>();
  const { influencer } = input;

  addCodesFromRaw(codes, sources, "influencer.country_code", influencer.country_code);
  addCodesFromRaw(codes, sources, "influencer.country_codes", influencer.country_codes);
  addCodesFromRaw(codes, sources, "influencer.nationality", influencer.nationality);
  addCodesFromRaw(codes, sources, "influencer.city", influencer.city);

  for (const entry of influencer.audience_top_countries ?? []) {
    addCodesFromRaw(
      codes,
      sources,
      "influencer.audience_top_countries",
      entry.code,
      entry.name
    );
  }

  for (const platform of input.platforms ?? []) {
    addCodesFromRaw(codes, sources, "platform.audience_country", platform.audience_country);
    addCodesFromRaw(codes, sources, "platform.profile_bio", platform.profile_bio);
    addCodesFromRaw(codes, sources, "platform.display_name", platform.profile_display_name);
  }

  for (const profile of input.discoveredProfiles ?? []) {
    addCodesFromRaw(codes, sources, "discovered_profile.country_code", profile.country_code);
    addCodesFromRaw(codes, sources, "discovered_profile.bio", profile.bio);
    addCodesFromRaw(codes, sources, "discovered_profile.city", profile.city);
  }

  if (input.dnaDocument) {
    try {
      const document = parseCreatorDNADocument(input.dnaDocument);
      if (envelopeHasValue(document.audience.country)) {
        addCodesFromRaw(
          codes,
          sources,
          "dna.audience.country",
          envelopeString(document.audience.country)
        );
      }
      const dnaCountries = envelopeStringArray(document.audience.countries);
      if (dnaCountries.length > 0) {
        addCodesFromRaw(codes, sources, "dna.audience.countries", dnaCountries);
      }
    } catch {
      // Ignore malformed DNA documents during backfill.
    }
  }

  addCodesFromRaw(
    codes,
    sources,
    "ipl.normalized_snapshot",
    (input.iplAudienceCountries ?? []).filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    )
  );
  addCodesFromRaw(
    codes,
    sources,
    "creator_intelligence.audience_countries",
    input.intelligenceAudienceCountries
  );

  const inferred = inferCountriesFromProfileSignals({
    bio: mergeText(
      ...(input.platforms ?? []).map((platform) => platform.profile_bio),
      ...(input.discoveredProfiles ?? []).map((profile) => profile.bio)
    ),
    displayName: influencer.display_name,
    city: mergeText(
      influencer.city,
      ...(input.discoveredProfiles ?? []).map((profile) => profile.city)
    ),
    hashtags: (input.platforms ?? []).flatMap((platform) => platform.hashtags ?? []),
    mentions: (input.platforms ?? []).flatMap((platform) => platform.mentions ?? []),
  });
  if (inferred.length > 0) {
    addCodesFromRaw(codes, sources, "bio_inference", inferred);
    sources.add("bio_inference");
  }

  return { codes, sources: [...sources] };
}

/** Collect stored signals and produce a merge-only influencer country write. */
export function buildCountryWriteFromStoredSignals(
  input: Parameters<typeof collectCountryCodesFromExistingData>[0]
): ReturnType<typeof buildInfluencerCountryWrite> {
  const collected = collectCountryCodesFromExistingData(input);
  return buildInfluencerCountryWrite({
    existingCountryCode: input.influencer.country_code,
    existingCountryCodes: input.influencer.country_codes,
    incomingCodes: [collected.codes],
  });
}

function mergeText(...parts: Array<string | null | undefined>): string | null {
  const merged = parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n");
  return merged || null;
}

export type CountryBackfillReport = {
  scanned: number;
  updated: number;
  skipped: number;
  unchanged: number;
  noSignal: number;
  dryRun: boolean;
};

export type CountryBackfillOptions = {
  dryRun?: boolean;
  batchSize?: number;
  influencerId?: string;
  limit?: number;
  /** Only process creators with no resolved country data. */
  missingOnly?: boolean;
  /** Only creators created within the last N days. */
  recentDays?: number;
  /** Match notes from Add Creator by URL (`Added via Discovery profile link`). */
  addedViaProfileUrl?: boolean;
  onProgress?: (progress: {
    scanned: number;
    updated: number;
    unchanged: number;
    noSignal: number;
  }) => void;
};

export async function backfillInfluencerCountryCodes(
  supabase: SupabaseClient,
  options: CountryBackfillOptions = {}
): Promise<CountryBackfillReport> {
  const dryRun = options.dryRun ?? false;
  const batchSize = options.batchSize ?? 100;
  const report: CountryBackfillReport = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    unchanged: 0,
    noSignal: 0,
    dryRun,
  };

  let offset = 0;
  while (true) {
    if (options.limit != null && report.scanned >= options.limit) break;

    let query = supabase
      .from("influencers")
      .select(
        "id, display_name, country_code, country_codes, city, nationality, audience_top_countries, created_at, notes"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (options.influencerId) {
      query = query.eq("id", options.influencerId);
    }
    if (options.recentDays != null && options.recentDays > 0) {
      const since = new Date(Date.now() - options.recentDays * 86_400_000).toISOString();
      query = query.gte("created_at", since);
    }
    if (options.addedViaProfileUrl) {
      query = query.ilike("notes", "%Added via Discovery profile link%");
    }

    const { data: influencers, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (influencers ?? []) as InfluencerBackfillRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (options.limit != null && report.scanned >= options.limit) break;

      if (
        options.missingOnly &&
        mergeCountryCodes(row.country_codes, row.country_code).length > 0
      ) {
        report.skipped += 1;
        continue;
      }

      report.scanned += 1;

      const influencer = row;

      const [platformsResult, discoveredResult, dnaResult, iplResult, intelligenceResult] =
        await Promise.all([
          supabase
            .from("influencer_platform_accounts")
            .select(
              "audience_country, profile_bio, profile_display_name, hashtags, mentions"
            )
            .eq("influencer_id", row.id),
          supabase
            .from("discovered_profiles")
            .select("country_code, bio, city")
            .eq("influencer_id", row.id),
          supabase
            .from("creator_dna")
            .select("document")
            .eq("influencer_id", row.id)
            .maybeSingle(),
          supabase
            .from("ipl_snapshots")
            .select("normalized_snapshot")
            .eq("influencer_id", row.id)
            .eq("is_latest", true),
          supabase
            .from("creator_intelligence")
            .select("audience_countries")
            .eq("unified_id", `inf:${row.id}`)
            .maybeSingle(),
        ]);

      if (platformsResult.error) throw new Error(platformsResult.error.message);
      if (discoveredResult.error) throw new Error(discoveredResult.error.message);
      if (dnaResult.error) throw new Error(dnaResult.error.message);
      if (iplResult.error) throw new Error(iplResult.error.message);
      if (intelligenceResult.error) throw new Error(intelligenceResult.error.message);

      const iplAudienceCountries = (iplResult.data ?? []).map((snapshot) => {
        const normalized = snapshot.normalized_snapshot as { audienceCountry?: string | null };
        return normalized?.audienceCountry ?? null;
      });

      const collected = buildCountryWriteFromStoredSignals({
        influencer,
        platforms: (platformsResult.data ?? []) as PlatformBackfillRow[],
        discoveredProfiles: (discoveredResult.data ?? []) as DiscoveredProfileBackfillRow[],
        dnaDocument: (dnaResult.data as { document?: unknown } | null)?.document,
        iplAudienceCountries,
        intelligenceAudienceCountries:
          (intelligenceResult.data as { audience_countries?: string[] | null } | null)
            ?.audience_countries ?? null,
      });

      if (!collected) {
        report.noSignal += 1;
        continue;
      }

      const write = collected;

      if (!write) {
        report.unchanged += 1;
        continue;
      }

      if (dryRun) {
        report.updated += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("influencers")
        .update({
          country_code: write.country_code,
          country_codes: write.country_codes,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", row.id);

      if (updateError) {
        report.skipped += 1;
        continue;
      }

      report.updated += 1;
    }

    options.onProgress?.({
      scanned: report.scanned,
      updated: report.updated,
      unchanged: report.unchanged,
      noSignal: report.noSignal,
    });

    if (options.influencerId) break;
    if (rows.length < batchSize) break;
    offset += batchSize;
  }

  return report;
}

export function hasAnyStoredCountrySignal(input: {
  country_code?: string | null;
  country_codes?: string[] | null;
  estimated_country?: string | null;
  platformAudienceCountries?: Array<string | null | undefined>;
}): boolean {
  return (
    mergeCountryCodes(
      input.country_codes,
      input.country_code,
      input.estimated_country,
      ...(input.platformAudienceCountries ?? [])
    ).length > 0
  );
}
