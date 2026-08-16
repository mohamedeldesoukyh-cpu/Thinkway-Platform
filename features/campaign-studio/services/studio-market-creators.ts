import { resolveCountryCode } from "@/lib/creators/country-code";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";

function labelForCode(code: string): string | undefined {
  return COUNTRY_OPTIONS.find((option) => option.value === code)?.label;
}

function marketTokens(markets: string[] | undefined): Set<string> {
  const tokens = new Set<string>();
  for (const raw of markets ?? []) {
    const value = raw.trim();
    if (!value) continue;
    tokens.add(value.toLowerCase());
    const code = resolveCountryCode(value);
    if (code) {
      tokens.add(code.toLowerCase());
      const label = labelForCode(code);
      if (label) tokens.add(label.toLowerCase());
      if (code === "AE") tokens.add("uae");
    }
  }
  return tokens;
}

function countryTokens(country: string | undefined): Set<string> {
  const tokens = new Set<string>();
  if (!country?.trim() || country.trim() === "—") return tokens;
  for (const part of country.split(/\s*[·|,/;+-]\s*/)) {
    const value = part.trim();
    if (!value) continue;
    tokens.add(value.toLowerCase());
    const code = resolveCountryCode(value);
    if (code) {
      tokens.add(code.toLowerCase());
      const label = labelForCode(code);
      if (label) tokens.add(label.toLowerCase());
      if (code === "AE") tokens.add("uae");
    }
  }
  return tokens;
}

function homeCountryLabel(country: string | undefined): string | undefined {
  if (!country?.trim() || country.trim() === "—") return undefined;
  return country
    .split(/\s*[·|,/;+-]\s*/)
    .map((part) => part.trim())
    .find(Boolean);
}

function canonicalCode(value: string | null | undefined): string | undefined {
  const code = resolveCountryCode(value);
  return code ? code.toUpperCase() : undefined;
}

export type StudioCreatorLocation = {
  country?: string | null;
  countryCode?: string | null;
  countryCodes?: string[] | null;
  estimatedCountry?: string | null;
  audienceCountries?: Array<string | null | undefined>;
};

/**
 * Creator home country for Studio market filtering. Audience countries
 * (platform `audience_country`, blended `estimated_country`) are never home.
 */
export function studioCreatorHomeCountryLabel(
  input: StudioCreatorLocation
): string | undefined {
  const primary = canonicalCode(input.countryCode);
  if (primary) return labelForCode(primary) ?? primary;

  const notHome = new Set<string>();
  for (const raw of [...(input.audienceCountries ?? []), input.estimatedCountry]) {
    const code = canonicalCode(raw);
    if (code) notHome.add(code);
  }

  const stored = (input.countryCodes ?? [])
    .map((value) => canonicalCode(value))
    .filter((code): code is string => Boolean(code));
  const homeCode = stored.find((code) => !notHome.has(code));
  if (homeCode) return labelForCode(homeCode) ?? homeCode;

  return homeCountryLabel(input.country ?? undefined);
}

/**
 * Keep a recommended creator when the campaign market is known and the
 * creator's home country overlaps that market. Audience-only countries do
 * not count. Unknown location is excluded once a market is set so UAE
 * audience flags cannot leak into an Egypt campaign.
 */
export function vendorMatchesCampaignMarket(
  input: StudioCreatorLocation,
  markets: string[] | undefined
): boolean {
  const targets = marketTokens(markets);
  if (targets.size === 0) return true;
  const home = studioCreatorHomeCountryLabel(input);
  const location = countryTokens(home);
  if (location.size === 0) return false;
  for (const token of location) {
    if (targets.has(token)) return true;
  }
  return false;
}

export function vendorCountryMatchesCampaignMarkets(
  country: string | undefined,
  markets: string[] | undefined
): boolean {
  return vendorMatchesCampaignMarket({ country }, markets);
}
