/**
 * Creator Intelligence — canonical creator semantics for the whole platform.
 *
 * Discovery acquires; enrichment resolves; this layer is the single truth.
 * Filtering, matching, ranking, Studio, Director, and Outputs consume the
 * resolver + matching engine — never raw provenance columns.
 *
 * See docs/CREATOR_INTELLIGENCE_ARCHITECTURE.md for the full design and the
 * phased rollout plan.
 */
export * from "./types";
export * from "./taxonomy";
export { resolveCreatorIntelligence, resolveCreatorIntelligenceBatch } from "./resolver";
export {
  campaignRequirementsFromFacts,
  matchCreatorToCampaign,
  matchCreatorsToCampaign,
} from "./matching";
export { evaluateIntelligenceCoverage } from "./coverage";
export type { IntelligenceCoverageReport, AttributeCoverage } from "./coverage";
export { getCreatorIntelligenceMode } from "./flags";
export type { CreatorIntelligenceMode } from "./flags";
export {
  compareCategoryFiltering,
  creatorIntelligenceMatchesCategories,
} from "./shadow";
export type { CategoryFilterShadowReport } from "./shadow";
