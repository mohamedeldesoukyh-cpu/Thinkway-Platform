/**
 * Discovery Search Phase 3A — Arabic/English text normalization (in-memory).
 */
import {
  containsArabicScript,
  normalizeArabicCategoryText,
} from "@/lib/creators/arabic-category-keywords";

/**
 * Normalize Arabic/English search text for consistent matching.
 * - Strips Arabic diacritics / tatweel; unifies alef / taa marbuta / alif maqsura
 * - Collapses whitespace; strips most punctuation
 * - Lowercases Latin letters
 * - Preserves leading @ for handle-shaped input
 */
export function normalizeDiscoverySearchText(input: string): string {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) return "";

  const hasAt = trimmed.startsWith("@");
  const body = hasAt ? trimmed.replace(/^@+/, "") : trimmed;

  let normalized = containsArabicScript(body)
    ? normalizeArabicCategoryText(body)
    : body.replace(/\s+/g, " ").trim();

  // Lowercase Latin only; leave Arabic code points untouched.
  normalized = normalized.replace(/[A-Za-z]+/g, (chunk) => chunk.toLowerCase());

  // Drop punctuation/symbols that are not useful for FTS tokens.
  // Keep letters (any script), digits, underscore, period, hyphen, spaces.
  normalized = normalized
    .replace(/[^\p{L}\p{N}_.\-\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  return hasAt ? `@${normalized}` : normalized;
}
