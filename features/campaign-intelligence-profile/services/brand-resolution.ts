import type { LiveMasters } from "@/lib/intelligence/entity-resolution/matchers";
import { resolveBrand } from "@/lib/intelligence/entity-resolution/matchers";

/** Known brand mentions that may appear in brief text under alternate spellings. */
export const KNOWN_BRAND_PATTERNS: Array<{ pattern: RegExp; searchLabel: string }> = [
  { pattern: /\betisalat\b/i, searchLabel: "Etisalat" },
  { pattern: /(?:^|\s)e\s*&(?!\.)(?:\s|$|[,;])/i, searchLabel: "E&" },
  { pattern: /\be\s+and\b|\beand\b/i, searchLabel: "Eand" },
];

export function findKnownBrandsInText(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, searchLabel } of KNOWN_BRAND_PATTERNS) {
    if (pattern.test(text)) found.push(searchLabel);
  }
  return found;
}

/** Split compound LLM labels like "E& / Etisalat" into searchable parts. */
export function expandBrandSearchTerms(terms: string[]): string[] {
  const expanded = new Set<string>();
  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    expanded.add(trimmed);
    for (const part of trimmed.split(/\s*\/\s*|\s+\|\s+|\s+and\s+/i)) {
      const piece = part.trim();
      if (piece) expanded.add(piece);
    }
  }
  return [...expanded];
}

function isEtisalatAliasToken(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    /^(e\s*&|e&|eand|e\s+and|etisalat|esalat)$/.test(v) ||
    /\betisalat\b/.test(v) ||
    /\besalat\b/.test(v) ||
    /^e\s*&/.test(v)
  );
}

/** True when needle and a live brand label refer to the same known alias group (e.g. E& ↔ Etisalat). */
export function brandMatchesAlias(needle: string, brandLabel: string): boolean {
  const n = needle.trim().toLowerCase();
  const b = brandLabel.trim().toLowerCase();
  if (!n || !b) return false;
  if (n === b) return true;

  const etisalatNeedle = isEtisalatAliasToken(n);
  const etisalatBrand =
    /\betisalat\b/.test(b) ||
    /\besalat\b/.test(b) ||
    /^e\s*&/.test(b) ||
    b.startsWith("e&");
  if (etisalatNeedle && etisalatBrand) return true;

  return false;
}

export function resolveBrandWithAliases(
  masters: LiveMasters,
  brandNames: string[],
  clientId: string | null
): { resolvedBrandId: string | null; confidence: number; matchedLabel: string | null } {
  const scoped = clientId
    ? masters.brands.filter((b) => b.client_id === clientId)
    : masters.brands;

  let best: { resolvedBrandId: string | null; confidence: number; matchedLabel: string | null } = {
    resolvedBrandId: null,
    confidence: 0,
    matchedLabel: null,
  };

  for (const rawName of expandBrandSearchTerms(brandNames)) {
    const name = rawName.trim();
    if (!name) continue;

    for (const brand of scoped) {
      if (brandMatchesAlias(name, brand.name)) {
        const confidence = 0.95;
        if (confidence > best.confidence) {
          best = { resolvedBrandId: brand.id, confidence, matchedLabel: brand.name };
        }
      }
    }

    const fuzzy = resolveBrand(masters, name, clientId);
    if (fuzzy.confidence > best.confidence) {
      const brand = masters.brands.find((b) => b.id === fuzzy.resolvedBrandId);
      best = {
        resolvedBrandId: fuzzy.resolvedBrandId,
        confidence: fuzzy.confidence,
        matchedLabel: brand?.name ?? name,
      };
    }
  }

  return best;
}
