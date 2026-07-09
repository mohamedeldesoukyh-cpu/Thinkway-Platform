export type {
  CampaignOption,
  DebateMetadata,
  DebateResult,
  DebateScore,
  DirectorMeetingDecision,
  DirectorReview,
  DirectorRole,
  OptionArchetype,
  OptionId,
} from "./debate-types";

export { generateCampaignOptions, getOptionById } from "./option-generator";
export { runLeadershipDebate, DIRECTOR_ROLES } from "./leadership-debate";
export { aggregateDebateScores, selectWinningOption, getDirectorCount } from "./debate-scorer";
export { runDirectorMeeting } from "./director-meeting";
export {
  runDirectorDebateEngine,
  validateOptionMaterialDifference,
  analyzeMaterialDimensions,
  summarizeOptionStrategy,
  MATERIAL_DIMENSIONS,
  MIN_MATERIAL_DIMENSIONS,
  type MaterialDifferenceValidation,
} from "./debate-engine";

export {
  applyWinnerOptionToStrategy,
  applyWinnerOptionToCampaignObject,
  buildDebateMetadata,
  buildDebateContext,
  getWinnerOption,
  getRejectedOptions,
  type DebateContext,
} from "./apply-winner";
