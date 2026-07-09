export type {
  CampaignFacts,
  CampaignFactsExtractInput,
  CampaignFactsField,
  CampaignFactsSource,
} from "./campaign-facts-types";

export { extractCampaignFacts } from "./extract-campaign-facts";
export { validateCampaignFacts, campaignFactsMatchCore } from "./validate-campaign-facts";
export {
  formatCampaignFactsForSpecialist,
  listPopulatedFactsFields,
} from "./facts-to-context";
export {
  applyFactsToSummaryData,
  applyFactsToSummaryDataOrLegacy,
  buildBudgetSectionDataFromFacts,
  buildCreatorMixFromFacts,
  buildCreatorMixFromReasoningTiers,
  buildGroundedKpisFromFacts,
  buildGroundedKpisFromStrategy,
  buildTimelineSectionDataFromFacts,
  creatorTierStrategyToMix,
  formatFactsBudgetDisplay,
  formatFactsDurationDisplay,
  getCampaignFacts,
  getCampaignFactsFromState,
  getCampaignFactsOrLegacy,
  hasCampaignFacts,
  resolveFactsBrandName,
  resolveFactsBudgetTotal,
  resolveFactsClientName,
  resolveFactsCurrency,
  resolveInfluencerEstimateCurrency,
  resolveFactsDurationWeeks,
  resolveFactsObjective,
} from "./facts-display-bridge";
