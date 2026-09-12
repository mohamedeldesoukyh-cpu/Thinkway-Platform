export type {
  CampaignIntelligenceProfile,
  CampaignIntelligenceProfileRow,
  CampaignSearchCriterion,
} from "./types/profile";
export type {
  CampaignConstraint,
  CampaignUnderstanding,
  CampaignUnderstandingStage,
  EvidenceReference,
  FactOrigin,
  FactScope,
  FactDerivation,
  QualityGateAssessment,
  QualityGateDimension,
  QualityGateStatus,
  SemanticFact,
  ScopeDimension,
  ScopeSelector,
  SourceMaterialBlock,
  SourceDocument,
  StageQualityGateRequirements,
  StageQualityGateResult,
  UnderstandingConfirmation,
  UnderstandingConflict,
  UnderstandingCoverage,
  UnderstandingQuestion,
  UnderstandingValidationIssue,
  RequirementCondition,
  RequirementConditionClause,
} from "./types/campaign-understanding";
export { CAMPAIGN_UNDERSTANDING_SCHEMA_VERSION } from "./types/campaign-understanding";
export { evaluateCampaignUnderstandingQualityGate } from "./services/campaign-understanding/quality-gate";
export {
  deriveUnderstandingCoverage,
  hasSourceEvidence,
  issuesForStage,
  validateCampaignUnderstanding,
} from "./services/campaign-understanding/validation";
export {
  campaignUnderstandingSchema,
  parseCampaignUnderstanding,
  safeParseCampaignUnderstanding,
} from "./services/campaign-understanding/campaign-understanding-schema";
export { profileToCampaignFacts } from "./services/profile-to-facts";
export {
  applyConfirmedCampaignFactsToCampaignObject,
  confirmCampaignIntelligenceProfile,
  isCampaignIntelligenceConfirmed,
  projectConfirmedCampaignFacts,
  resolveCampaignFactsSSot,
  syncStoredTimelineToFacts,
  unconfirmCampaignIntelligenceProfile,
} from "./services/campaign-facts-spine";
export {
  buildBrowseFiltersFromProfile,
  buildCreatorFiltersFromProfile,
  buildSearchStrategyFromProfile,
  mapProfileToDiscoverySearch,
} from "./services/search-strategy";
export {
  CIP_FIELDS_EXCLUDED_FROM_DISCOVERY,
  DISCOVERY_SEARCH_FILTER_KEYS,
  discoveryMappedFiltersToBrowseFilters,
  discoveryMappedFiltersToCreatorFilters,
  discoveryMappedFiltersToCriteria,
  mapCampaignIntelligenceToDiscoverySearch,
  type DiscoveryMappedFilter,
  type DiscoverySearchFilterKey,
  type DiscoverySearchMappingResult,
} from "./services/discovery-search-mapping";
export { searchStrategyToBrowseFilters, searchStrategyToCreatorFilters } from "./services/strategy-to-filters";
