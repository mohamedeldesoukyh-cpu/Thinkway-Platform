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

/**
 * Keep a recommended creator when the campaign market is known and the
 * creator's home country overlaps that market. Audience-only countries in
 * the display label (for example "UAE · Egypt") do not count. Unknown
 * location stays visible.
 */
export function vendorCountryMatchesCampaignMarkets(
  country: string | undefined,
  markets: string[] | undefined
): boolean {
  const targets = marketTokens(markets);
  if (targets.size === 0) return true;
  const home = homeCountryLabel(country);
  const location = countryTokens(home);
  if (location.size === 0) return true;
  for (const token of location) {
    if (targets.has(token)) return true;
  }
  return false;
}
