export { normalizeSearchTerm, fuzzyConfidence, levenshtein } from "../search/fuzzy-match";
export {
  extractEntityCandidates,
  extractTwDocumentNumbers,
  inferEntityTypeFromDocumentNumber,
  detectPlatform,
} from "../search/patterns";

export const SEARCH_PRIORITY_ORDER = [
  "document_number",
  "uuid",
  "exact_name",
  "alias",
  "partial",
  "fuzzy",
] as const;

export type SearchPriorityStep = (typeof SEARCH_PRIORITY_ORDER)[number];

export function isFuzzyAllowed(
  attempted: SearchPriorityStep[],
  hasPriorResults: boolean
): boolean {
  if (hasPriorResults) return false;
  const nonFuzzy = SEARCH_PRIORITY_ORDER.filter((s) => s !== "fuzzy");
  return nonFuzzy.every((step) => attempted.includes(step));
}
