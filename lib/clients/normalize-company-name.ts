const LEGAL_SUFFIX_TOKENS = new Set([
  "ltd",
  "limited",
  "llc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "plc",
  "gmbh",
  "bv",
  "sa",
  "ag",
  "nv",
  "lp",
  "llp",
  "co",
  "company",
  "pty",
  "pte",
  "srl",
  "spa",
  "ab",
  "as",
  "kg",
]);

const REGIONAL_SUFFIX_TOKENS = new Set([
  "egypt",
  "uae",
  "ksa",
  "qatar",
  "kuwait",
  "bahrain",
  "oman",
  "jordan",
  "lebanon",
  "morocco",
  "tunisia",
  "algeria",
  "emirates",
]);

export function normalizeCompanyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripLegalSuffixes(name: string): string {
  const tokens = name.split(" ").filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!;
    if (LEGAL_SUFFIX_TOKENS.has(last) || REGIONAL_SUFFIX_TOKENS.has(last)) {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens.join(" ");
}

/** Canonical key for classification cache lookups. */
export function normalizeCompanyNameForCache(name: string): string {
  const normalized = normalizeCompanyKey(name);
  const stripped = stripLegalSuffixes(normalized);
  return stripped || normalized;
}

export function companyNameVariants(companyName: string): string[] {
  const normalized = normalizeCompanyKey(companyName);
  const stripped = stripLegalSuffixes(normalized);
  return [...new Set([normalized, stripped].filter(Boolean))];
}
