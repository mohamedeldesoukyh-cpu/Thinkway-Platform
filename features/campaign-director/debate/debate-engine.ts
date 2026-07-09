import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "../types";
import type { DebateResult } from "./debate-types";
import { aggregateDebateScores } from "./debate-scorer";
import { runDirectorMeeting } from "./director-meeting";
import { runLeadershipDebate } from "./leadership-debate";
import {
  analyzeMaterialDimensions,
  validateOptionMaterialDifference,
  type MaterialDifferenceValidation,
} from "./material-difference-validator";
import { generateCampaignOptions } from "./option-generator";

export type { MaterialDifferenceValidation };

/** Orchestrate full IS-3 debate: generate → validate → review → score → meeting. */
export function runDirectorDebateEngine(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument
): DebateResult {
  const options = generateCampaignOptions(facts, strategy);
  const materialValidation = validateOptionMaterialDifference(options);

  if (!materialValidation.valid) {
    throw new Error(
      `IS-3 material difference validation failed: ${materialValidation.errors.join("; ")}`
    );
  }

  const reviews = runLeadershipDebate(options, facts, strategy);
  const scores = aggregateDebateScores(options, reviews);
  const meeting = runDirectorMeeting(options, reviews, scores);

  return {
    options,
    reviews,
    scores,
    meeting,
    materialDifferenceValidated: true,
    ranAt: new Date().toISOString(),
  };
}

export {
  analyzeMaterialDimensions,
  validateOptionMaterialDifference,
  summarizeOptionStrategy,
  MATERIAL_DIMENSIONS,
  MIN_MATERIAL_DIMENSIONS,
} from "./material-difference-validator";

export { validateOptionMaterialDifference as validateMaterialDifference };
