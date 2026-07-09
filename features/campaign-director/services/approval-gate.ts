import type { ApprovalGate, CrossReviewFinding, DirectorChallenge } from "../types";
import { countOpenChallenges } from "./conflict-detector";
import { countOpenCrossReviewFindings } from "./cross-review-engine";

/** Campaign approved ONLY when zero unresolved conflicts. */
export function evaluateApprovalGate(input: {
  challenges: DirectorChallenge[];
  crossReviewFindings: CrossReviewFinding[];
  revisionRounds: number;
  budgetValid: boolean;
  timelineClientFacing: boolean;
}): ApprovalGate {
  const unresolvedConflictCount = countOpenChallenges(input.challenges);
  const crossReviewOpenCount = countOpenCrossReviewFindings(input.crossReviewFindings);
  const blockers: string[] = [];

  if (unresolvedConflictCount > 0) {
    blockers.push(`${unresolvedConflictCount} director challenge(s) still open`);
  }
  if (crossReviewOpenCount > 0) {
    blockers.push(`${crossReviewOpenCount} cross-review finding(s) unresolved`);
  }
  if (!input.budgetValid) {
    blockers.push("Budget allocations do not sum to 100%");
  }
  if (!input.timelineClientFacing) {
    blockers.push("Timeline contains non-client-facing phases");
  }

  const approved =
    unresolvedConflictCount === 0 &&
    crossReviewOpenCount === 0 &&
    input.budgetValid &&
    input.timelineClientFacing;

  return {
    approved,
    unresolvedConflictCount: unresolvedConflictCount + crossReviewOpenCount,
    crossReviewOpenCount,
    revisionRounds: input.revisionRounds,
    approvedAt: approved ? new Date().toISOString() : undefined,
    blockers,
  };
}
