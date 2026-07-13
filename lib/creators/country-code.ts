import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";

/**
 * Country aliases not covered by the `COUNTRY_OPTIONS` labels alone. This is the
 * single alias registry for the platform — the creator-search parser imports it
 * from here so there is exactly one country name→code mapping.
 */
export const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  uae: "AE",
  emirates: "AE",
  dubai: "AE",
  "abu dhabi": "AE",
  ksa: "SA",
  saudi: "SA",
  "arab republic of egypt": "EG",
  // Brief scanners match these as phrases too (a brief saying "Cairo" targets EG),
  // so name/city aliases live here — never in per-feature copies.
  egypt: "EG",
  cairo: "EG",
  alexandria: "EG",
  riyadh: "SA",
  jeddah: "SA",
  uk: "GB",
  usa: "US",
};

function normalizePhrase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const VALID_CODES = new Set<string>(COUNTRY_OPTIONS.map((option) => option.value.toUpperCase()));

const NAME_TO_CODE = new Map<string, string>();
for (const option of COUNTRY_OPTIONS) {
  NAME_TO_CODE.set(normalizePhrase(option.label), option.value);
}
for (const [phrase, code] of Object.entries(COUNTRY_ALIASES)) {
  NAME_TO_CODE.set(normalizePhrase(phrase), code);
}

/**
 * Resolve a user- or brief-provided country value to its canonical ISO-2 code.
 *
 * The Discovery layer filters creators by the ISO-2 `country_code` column, but
 * upstream callers may pass a country name ("Egypt" / "EGYPT" / "Arab Republic
 * of Egypt") instead of the code ("EG"). This resolver is the single
 * normalization boundary that makes Discovery resilient to both.
 *
 *   EG / Egypt / EGYPT / egypt / Arab Republic of Egypt → EG
 *   AE / United Arab Emirates / uae / dubai              → AE
 *
 * Idempotent (`resolveCountryCode("EG") === "EG"`). Already-valid codes and
 * unknown values pass through unchanged (uppercased), so nothing that already
 * worked can break.
 */
export function resolveCountryCode(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (VALID_CODES.has(upper)) return upper; // already a canonical ISO-2 code
  const byName = NAME_TO_CODE.get(normalizePhrase(raw));
  if (byName) return byName; // country name / alias → ISO-2 code
  return upper; // unknown value — pass through unchanged (uppercased)
}
