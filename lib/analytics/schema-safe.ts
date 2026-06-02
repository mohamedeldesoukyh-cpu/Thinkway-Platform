import { devLog } from "@/lib/platform/logger";

export { isMissingColumnError } from "@/lib/platform/schema-validation";

/** Loose row shape from Supabase embeds — only read fields that may exist. */
export type CountryCarrier = Record<string, unknown>;

const CLIENT_COUNTRY_KEYS = [
  "country_code",
  "country",
  "country_name",
  "billing_country",
] as const;

const BRAND_COUNTRY_KEYS = ["country_code", "country", "country_name"] as const;

function normalizeCountryCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Unknown";
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return trimmed.slice(0, 32);
}

/**
 * Resolves client country from the first available column on the current schema.
 * Priority: country_code → country → country_name → billing_country
 */
export function resolveClientCountry(
  client: CountryCarrier | null | undefined
): string | null {
  if (!client) return null;

  for (const key of CLIENT_COUNTRY_KEYS) {
    const value = client[key];
    if (typeof value === "string" && value.trim().length > 0) {
      const resolved = normalizeCountryCode(value);
      if (process.env.NODE_ENV === "development" && key !== "country_code") {
        devLog("[analytics-schema] resolveClientCountry via", key, resolved);
      }
      return resolved === "Unknown" ? null : resolved;
    }
  }

  return null;
}

export function resolveBrandCountry(
  brand: CountryCarrier | null | undefined
): string | null {
  if (!brand) return null;

  for (const key of BRAND_COUNTRY_KEYS) {
    const value = brand[key];
    if (typeof value === "string" && value.trim().length > 0) {
      const resolved = normalizeCountryCode(value);
      return resolved === "Unknown" ? null : resolved;
    }
  }

  return null;
}

export function resolveFactCountryCode(input: {
  client?: CountryCarrier | null;
  brand?: CountryCarrier | null;
}): string | null {
  return (
    resolveClientCountry(input.client) ??
    resolveBrandCountry(input.brand) ??
    null
  );
}

/** Returns a display-safe dimension label. */
export function safeDimensionValue(
  value: unknown,
  fallback = "Unknown"
): string {
  if (value == null) return fallback;
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

/** Picks the first defined value from a priority list (schema column fallbacks). */
export function pickColumnFallback<T>(...candidates: (T | null | undefined)[]): T | null {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }
  return null;
}

/** @deprecated Use pickColumnFallback — alias for task naming. */
export const hasColumnFallback = pickColumnFallback;

export function countryCodeForRollup(country: string | null | undefined): string {
  return safeDimensionValue(country, "Unknown").toUpperCase();
}
