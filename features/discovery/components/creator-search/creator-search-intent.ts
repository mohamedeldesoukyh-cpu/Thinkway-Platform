import type { DiscoverySearchTaxonomy } from "./creator-search-taxonomy";
import {
  scoreCreatorSearchIntent,
  simplifyCreatorSearchQuery,
  type CreatorSearchIntentMode,
  type CreatorSearchIntentResult,
} from "./creator-search-intent-engine";
import { buildDiscoverySearchTaxonomyIndex } from "./creator-search-taxonomy";

export type { CreatorSearchIntentMode, CreatorSearchIntentResult } from "./creator-search-intent-engine";
export { simplifyCreatorSearchQuery, scoreCreatorSearchIntent } from "./creator-search-intent-engine";

/** @deprecated Use CreatorSearchIntentMode */
export type CreatorSearchIntent = CreatorSearchIntentMode | "exact_creator" | "category_keyword";

const EMPTY_TAXONOMY = buildDiscoverySearchTaxonomyIndex([]);

/** Legacy adapter — prefer scoreCreatorSearchIntent with taxonomy. */
export function classifyCreatorSearchIntent(
  rawQuery: string,
  taxonomy: DiscoverySearchTaxonomy = EMPTY_TAXONOMY
): CreatorSearchIntentMode | "exact_creator" | "category_keyword" {
  const result = scoreCreatorSearchIntent(rawQuery, taxonomy);
  if (result.mode === "exact") return "exact_creator";
  if (result.signals.taxonomyMatch.level !== "none" && result.mode === "discovery") {
    return "category_keyword";
  }
  return result.mode;
}
