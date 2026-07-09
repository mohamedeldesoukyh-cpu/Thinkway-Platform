/**
 * Geo- and niche-aware Apify acquisition seeds (e.g. L'Oréal Egypt skincare).
 */

import { LOCATION_DISCOVERY_TARGETS } from "@/lib/discovery/types";
import type { DiscoveryCoverageIntent } from "@/lib/creators/discovery-coverage";

export type GeoAcquisitionSeedInput = {
  country?: string | null;
  categories?: string[];
  niches?: string[];
  audience?: string | null;
};

export type GeoAcquisitionSeeds = {
  /** Primary single-token hashtag for Apify explore (no spaces). */
  primaryHashtag: string;
  fallbackHashtags: string[];
  /** Human-readable location hint for audit logs. */
  locationLabel: string;
  locationCountry?: string;
  nicheToken?: string;
  geoToken?: string;
};

const GENERIC_CATEGORY_TOKENS = new Set([
  "beauty",
  "makeup",
  "lifestyle",
  "fashion",
  "creator",
  "influencer",
  "content",
  "brand",
  "campaign",
  "followers",
  "engagement",
]);

const FOLLOWER_RANGE = /\d+\s*k|\d+\s*-\s*\d+|followers?/i;

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function tokenizeAudience(audience: string | null | undefined): string[] {
  if (!audience?.trim()) return [];
  return audience
    .split(/[\s,;/]+/)
    .map((part) => part.trim().toLowerCase().replace(/^#+/, ""))
    .filter((part) => part.length > 2 && !FOLLOWER_RANGE.test(part));
}

/** Country-level tokens for localized Instagram hashtags (broader than city-only). */
const COUNTRY_HASHTAG_GEO: Record<string, string> = {
  EG: "egypt",
  AE: "dubai",
  SA: "ksa",
  QA: "qatar",
  KW: "kuwait",
  BH: "bahrain",
  OM: "oman",
  JO: "jordan",
  LB: "lebanon",
};

function resolveGeoToken(countryCode: string | undefined): string | undefined {
  if (!countryCode?.trim()) return undefined;
  const code = countryCode.trim().toUpperCase();
  if (COUNTRY_HASHTAG_GEO[code]) return COUNTRY_HASHTAG_GEO[code];
  const target = LOCATION_DISCOVERY_TARGETS.find((entry) => entry.country === code);
  if (target) return target.queries[0];
  return code.toLowerCase();
}

function extractNicheTokens(input: GeoAcquisitionSeedInput): string[] {
  const tokens: string[] = [];

  for (const niche of input.niches ?? []) {
    const normalized = normalizeToken(niche);
    if (normalized && !GENERIC_CATEGORY_TOKENS.has(normalized)) {
      tokens.push(normalized);
    }
  }

  for (const token of tokenizeAudience(input.audience)) {
    if (!GENERIC_CATEGORY_TOKENS.has(token)) {
      tokens.push(normalizeToken(token));
    }
  }

  for (const category of input.categories ?? []) {
    const normalized = normalizeToken(category);
    if (normalized && !GENERIC_CATEGORY_TOKENS.has(normalized) && !FOLLOWER_RANGE.test(category)) {
      tokens.push(normalized);
    }
  }

  return [...new Set(tokens.filter(Boolean))];
}

function compoundHashtag(niche: string, geo: string): string[] {
  const n = normalizeToken(niche);
  const g = normalizeToken(geo);
  if (!n || !g) return [];
  return [...new Set([`${n}${g}`, `${g}${n}`, `${g}${n}`.replace(/^(cairo|dubai|riyadh)/, "$1")])].filter(
    (tag) => tag.length >= 4
  );
}

/**
 * Build localized Apify seeds from campaign coverage intent.
 * Example: EG + skincare → primary `skincareegypt`, fallbacks `egyptskincare`, `cairoskincare`.
 */
export function buildGeoTargetedAcquisitionSeeds(
  input: GeoAcquisitionSeedInput
): GeoAcquisitionSeeds {
  const country = input.country?.trim().toUpperCase();
  const geoToken = resolveGeoToken(country);
  const nicheTokens = extractNicheTokens(input);
  const niche = nicheTokens[0];

  if (country && geoToken) {
    if (!niche) {
      const cityCompound =
        geoToken === "egypt"
          ? ["cairo", "egyptian", "alexandria"]
          : geoToken === "dubai" || geoToken === "uae"
            ? ["dubai", "uae"]
            : geoToken === "ksa" || geoToken === "riyadh"
              ? ["riyadh", "ksa"]
              : [];

      return {
        primaryHashtag: geoToken,
        fallbackHashtags: cityCompound.filter((tag) => tag !== geoToken),
        locationLabel: geoToken,
        locationCountry: country,
        geoToken,
      };
    }

    const compounds = compoundHashtag(niche, geoToken);
    const cityCompound =
      geoToken === "egypt"
        ? [`cairo${niche}`, `${niche}cairo`, `egyptian${niche}`]
        : geoToken === "dubai" || geoToken === "uae"
          ? [`dubai${niche}`, `${niche}dubai`]
          : geoToken === "riyadh" || geoToken === "ksa"
            ? [`riyadh${niche}`, `${niche}ksa`]
            : [];

    const primaryHashtag = compounds[0] ?? `${niche}${geoToken}`;
    const fallbackHashtags = [...new Set([...compounds.slice(1), ...cityCompound])].filter(
      (tag) => tag !== primaryHashtag
    );

    return {
      primaryHashtag,
      fallbackHashtags,
      locationLabel: `${geoToken} ${niche}`,
      locationCountry: country,
      nicheToken: niche,
      geoToken,
    };
  }

  const generic =
    nicheTokens[0] ?? normalizeToken(input.categories?.[0] ?? "") ?? "creator";

  return {
    primaryHashtag: generic,
    fallbackHashtags: nicheTokens.slice(1),
    locationLabel: generic,
    locationCountry: country,
    nicheToken: nicheTokens[0],
    geoToken,
  };
}

export function buildGeoTargetedAcquisitionSeedsFromIntent(
  intent: DiscoveryCoverageIntent = {}
): GeoAcquisitionSeeds {
  return buildGeoTargetedAcquisitionSeeds({
    country: intent.country,
    categories: intent.categories,
    niches: intent.niches,
    audience: intent.audience,
  });
}
