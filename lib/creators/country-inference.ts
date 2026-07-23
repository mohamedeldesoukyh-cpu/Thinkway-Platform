import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import { COUNTRY_ALIASES, resolveCountryCode } from "@/lib/creators/country-code";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";

export type CountryInferenceInput = {
  bio?: string | null;
  displayName?: string | null;
  city?: string | null;
  handle?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
};

type GeographyMatch = {
  code: string;
  phrase: string;
};

function normalizePhrase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGeographyIndex(): GeographyMatch[] {
  const matches: GeographyMatch[] = [];

  for (const option of COUNTRY_OPTIONS) {
    matches.push({ code: option.value, phrase: normalizePhrase(option.label) });
  }

  for (const [phrase, code] of Object.entries(COUNTRY_ALIASES)) {
    matches.push({ code, phrase: normalizePhrase(phrase) });
  }

  return matches.sort((a, b) => b.phrase.length - a.phrase.length);
}

const GEOGRAPHY_INDEX = buildGeographyIndex();

const LOCATION_SEGMENT_SPLIT = /\s*(?:\/|\||·|,)\s*/;

function addCountryCode(codes: string[], seen: Set<string>, raw: string | null | undefined): void {
  const resolved = normalizeCountryCode(resolveCountryCode(raw));
  if (!resolved || seen.has(resolved)) return;
  seen.add(resolved);
  codes.push(resolved);
}

/**
 * Inverse of {@link countryFlag}: regional-indicator pairs (🇪🇬) → ISO-2 (EG).
 * Existing write paths already store flag emojis in bios; this restores extraction
 * without a new provider call.
 */
export function extractCountryCodesFromFlagEmojis(
  text: string | null | undefined
): string[] {
  const raw = text?.trim();
  if (!raw) return [];

  const codes: string[] = [];
  const seen = new Set<string>();
  const chars = [...raw];

  for (let i = 0; i < chars.length - 1; i++) {
    const a = chars[i].codePointAt(0) ?? 0;
    const b = chars[i + 1].codePointAt(0) ?? 0;
    if (a < 0x1f1e6 || a > 0x1f1ff || b < 0x1f1e6 || b > 0x1f1ff) continue;
    const code = String.fromCharCode(a - 0x1f1e6 + 65, b - 0x1f1e6 + 65);
    addCountryCode(codes, seen, code);
    i += 1;
  }

  return codes;
}

/** Extract all ISO-2 country codes mentioned in free text (bio, city, display name, etc.). */
export function extractCountryCodesFromText(text: string | null | undefined): string[] {
  const raw = text?.trim();
  if (!raw) return [];

  const codes: string[] = [];
  const seen = new Set<string>();

  for (const flagCode of extractCountryCodesFromFlagEmojis(raw)) {
    addCountryCode(codes, seen, flagCode);
  }

  const segments = raw
    .split(LOCATION_SEGMENT_SPLIT)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const scanTargets = segments.length > 1 ? segments : [raw];

  for (const target of scanTargets) {
    const normalized = normalizePhrase(target);
    if (!normalized) continue;

    for (const match of GEOGRAPHY_INDEX) {
      if (!match.phrase) continue;
      const pattern = new RegExp(
        `(?:^|\\s)${match.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`,
        "i"
      );
      if (!pattern.test(normalized)) continue;
      addCountryCode(codes, seen, match.code);
    }
  }

  return codes;
}

/** Infer creator countries from profile signals when enrichment metadata is missing. */
export function inferCountriesFromProfileSignals(input: CountryInferenceInput): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();

  const textParts = [
    input.bio,
    input.displayName,
    input.city,
    input.handle,
    ...(input.hashtags ?? []),
    ...(input.mentions ?? []),
  ];

  for (const part of textParts) {
    for (const code of extractCountryCodesFromText(part)) {
      addCountryCode(codes, seen, code);
    }
  }

  return codes;
}

export function mergeCountryCodes(
  ...groups: Array<string[] | string | null | undefined>
): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    const items = Array.isArray(group) ? group : group ? [group] : [];
    for (const item of items) {
      addCountryCode(codes, seen, item);
    }
  }

  return codes;
}

export function resolveCreatorCountryCodes(input: {
  country_codes?: string[] | null;
  country_code?: string | null;
  estimated_country?: string | null;
  platformAudienceCountries?: Array<string | null | undefined>;
}): string[] {
  return mergeCountryCodes(
    input.country_codes,
    input.country_code,
    input.estimated_country,
    ...(input.platformAudienceCountries ?? [])
  );
}

export type InfluencerCountryWrite = {
  country_code: string | null;
  country_codes: string[];
};

export type CreatorCountryWriteFromProfileInput = {
  existingCountryCode?: string | null;
  existingCountryCodes?: string[] | null;
  audienceCountry?: string | null;
  platformAudienceCountry?: string | null;
  bio?: string | null;
  fallbackBio?: string | null;
  displayName?: string | null;
  city?: string | null;
  handle?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
};

/** Shared Apify/profile enrichment country merge — used by import and enrichment pipelines. */
export function buildCreatorCountryWriteFromApifyProfile(
  input: CreatorCountryWriteFromProfileInput & {
    preferredPrimary?: string | null;
    preserveExistingPrimary?: boolean;
  }
): InfluencerCountryWrite | null {
  const bio = input.bio?.trim() || input.fallbackBio?.trim() || null;
  const { preferredPrimary, preserveExistingPrimary, ...profileInput } = input;
  return buildInfluencerCountryWrite({
    existingCountryCode: profileInput.existingCountryCode,
    existingCountryCodes: profileInput.existingCountryCodes,
    incomingCodes: [
      profileInput.audienceCountry,
      profileInput.platformAudienceCountry,
      inferCountriesFromProfileSignals({
        bio,
        displayName: profileInput.displayName,
        city: profileInput.city,
        handle: profileInput.handle,
        hashtags: profileInput.hashtags,
        mentions: profileInput.mentions,
      }),
    ],
    preferredPrimary,
    preserveExistingPrimary,
  });
}

/** Merge incoming codes with existing influencer country fields for DB writes. */
export function buildInfluencerCountryWrite(input: {
  existingCountryCode?: string | null;
  existingCountryCodes?: string[] | null;
  incomingCodes?: Array<string[] | string | null | undefined>;
  /** Manual edits — force this ISO code as primary when present in merged set. */
  preferredPrimary?: string | null;
  /**
   * When true (default), keep existing primary if still present after merge.
   * Prevents sparse re-enrichment from demoting or dropping valid countries.
   */
  preserveExistingPrimary?: boolean;
}): InfluencerCountryWrite | null {
  const merged = mergeCountryCodes(
    input.existingCountryCodes,
    input.existingCountryCode,
    ...(input.incomingCodes ?? [])
  );
  if (merged.length === 0) return null;

  const existing = mergeCountryCodes(input.existingCountryCodes, input.existingCountryCode);
  const primary = resolvePrimaryCountryCode(merged, {
    existingCountryCode: input.existingCountryCode,
    preferredPrimary: input.preferredPrimary,
    preserveExistingPrimary: input.preserveExistingPrimary !== false,
  });
  const unchanged =
    JSON.stringify(merged) === JSON.stringify(existing) &&
    normalizeCountryCode(input.existingCountryCode) === primary;

  if (unchanged) return null;
  return { country_code: primary, country_codes: merged };
}

function resolvePrimaryCountryCode(
  merged: string[],
  input: {
    existingCountryCode?: string | null;
    preferredPrimary?: string | null;
    preserveExistingPrimary: boolean;
  }
): string | null {
  if (merged.length === 0) return null;

  const preferred = normalizeCountryCode(input.preferredPrimary);
  if (preferred && merged.includes(preferred)) return preferred;

  if (input.preserveExistingPrimary) {
    const existingPrimary = normalizeCountryCode(input.existingCountryCode);
    if (existingPrimary && merged.includes(existingPrimary)) return existingPrimary;
  }

  return merged[0] ?? null;
}

/** SQL/PostgREST filter: match primary country_code or any entry in country_codes. */
export function applyInfluencerCountryBrowseFilter<
  Q extends {
    eq: (column: string, value: string) => Q;
    or: (filters: string) => Q;
  },
>(query: Q, country: string | null | undefined): Q {
  const resolved = normalizeCountryCode(resolveCountryCode(country));
  if (!resolved) return query;
  return query.or(`country_code.eq.${resolved},country_codes.cs.{${resolved}}`);
}
