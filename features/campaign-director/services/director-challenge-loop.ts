import type {
  CampaignStrategyDocument,
  CrossReviewFinding,
  DirectorChallenge,
  DirectorSpecialistId,
  SpecialistOutput,
} from "../types";
import type {
  DirectorReviewReport,
  DirectorReviewReportEntry,
  ReviewConversationTurn,
  SpecialistRevision,
} from "../types/review-conversation";
import { detectConflicts } from "./conflict-detector";
import {
  countOpenCrossReviewFindings,
  getOpenCrossReviewFindings,
  refreshCrossReviewResolution,
} from "./cross-review-engine";
import {
  applySpecialistRevision,
  MAX_REVISION_ROUNDS,
  runRevisionValidators,
} from "./revision-engine";

export type ChallengeLoopResult = {
  outputs: SpecialistOutput[];
  challenges: DirectorChallenge[];
  crossReviewFindings: CrossReviewFinding[];
  revisionRounds: number;
  strategy: CampaignStrategyDocument;
  reviewReport: DirectorReviewReport;
  conversation: ReviewConversationTurn[];
};

type SpecialistReviewState = {
  initialRecommendation: string;
  revisions: SpecialistRevision[];
  conversation: ReviewConversationTurn[];
  whoFoundIt?: DirectorSpecialistId | "director";
  conflictFound: boolean;
};

function turn(
  speaker: ReviewConversationTurn["speaker"],
  message: string,
  action: ReviewConversationTurn["action"],
  round: number
): ReviewConversationTurn {
  return { speaker, message, action, round, timestamp: new Date().toISOString() };
}

function initReviewState(outputs: SpecialistOutput[]): Map<DirectorSpecialistId, SpecialistReviewState> {
  const map = new Map<DirectorSpecialistId, SpecialistReviewState>();
  for (const output of outputs) {
    map.set(output.specialistId, {
      initialRecommendation: output.what,
      revisions: [],
      conversation: [],
      conflictFound: false,
    });
  }
  return map;
}

function buildReviewReport(input: {
  reviewStates: Map<DirectorSpecialistId, SpecialistReviewState>;
  outputs: SpecialistOutput[];
  conversation: ReviewConversationTurn[];
  revisionRounds: number;
  directorApproved: boolean;
}): DirectorReviewReport {
  const entries: DirectorReviewReportEntry[] = [];

  for (const output of input.outputs) {
    const state = input.reviewStates.get(output.specialistId);
    if (!state) continue;

    const latestRevision = state.revisions[state.revisions.length - 1];
    entries.push({
      specialist: output.specialistId,
      initialRecommendation: state.initialRecommendation,
      conflictFound: state.conflictFound,
      whoFoundIt: state.whoFoundIt,
      revision: latestRevision,
      revisions: state.revisions,
      finalApproval: output.what,
      reasonForApproval: output.why,
      reviewRounds: state.revisions.length,
      conversation: state.conversation,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalReviewRounds: input.revisionRounds,
    directorApproved: input.directorApproved,
    directorApprovalReason: input.directorApproved
      ? "All specialist conflicts resolved — final revised outputs approved for CampaignObject merge"
      : "Unresolved conflicts remain — CampaignObject sections withheld",
    entries,
    conversation: input.conversation,
  };
}

/**
 * Director challenge loop — internal review conversation with specialist self-revision.
 * Conflicts route back to owning specialist; validators confirm without owning fixes.
 */
export function runDirectorChallengeLoop(input: {
  strategy: CampaignStrategyDocument;
  briefText: string;
  outputs: SpecialistOutput[];
  crossReviewFindings: CrossReviewFinding[];
  timelineContent?: string;
}): ChallengeLoopResult {
  let { strategy, outputs } = input;
  const allChallenges: DirectorChallenge[] = [];
  const conversation: ReviewConversationTurn[] = [];
  const reviewStates = initReviewState(outputs);
  let revisionRounds = 0;
  let crossReviewFindings = [...input.crossReviewFindings];

  for (let round = 1; round <= MAX_REVISION_ROUNDS; round++) {
    const conflictChallenges = detectConflicts({
      strategy,
      outputs,
      briefText: input.briefText,
      timelineContent: input.timelineContent,
    });

    const openCrossReview = getOpenCrossReviewFindings(
      strategy,
      outputs,
      input.briefText,
      input.timelineContent
    ).filter(
      (f) =>
        !crossReviewFindings.some((existing) => existing.id === f.id && existing.resolved)
    );

    const openChallenges = conflictChallenges.filter((c) => c.resolutionStatus === "open");
    const hasWork = openChallenges.length > 0 || openCrossReview.length > 0;

    if (!hasWork) {
      allChallenges.push(
        ...conflictChallenges.map((c) => ({ ...c, resolutionStatus: "resolved" as const }))
      );
      crossReviewFindings = refreshCrossReviewResolution(
        crossReviewFindings,
        strategy,
        outputs,
        input.briefText,
        input.timelineContent
      );
      break;
    }

    revisionRounds++;

    const issues: Array<
      | { kind: "cross_review"; finding: CrossReviewFinding }
      | { kind: "challenge"; challenge: DirectorChallenge }
    > = [
      ...openCrossReview.map((finding) => ({ kind: "cross_review" as const, finding })),
      ...openChallenges.map((challenge) => ({ kind: "challenge" as const, challenge })),
    ];

    const processedTargets = new Set<DirectorSpecialistId>();

    for (const issue of issues) {
      const targetId =
        issue.kind === "cross_review" ? issue.finding.targetId : issue.challenge.assignedTo;

      if (processedTargets.has(targetId)) continue;
      processedTargets.add(targetId);

      const foundBy =
        issue.kind === "cross_review" ? issue.finding.reviewerId : ("director" as const);

      const revisionResult = applySpecialistRevision({
        strategy,
        briefText: input.briefText,
        outputs,
        issue,
        round,
        timelineContent: input.timelineContent,
      });

      if (!revisionResult) continue;

      strategy = revisionResult.strategy;
      outputs = revisionResult.outputs;
      conversation.push(...revisionResult.conversationTurns);

      const state = reviewStates.get(targetId);
      if (state) {
        state.conflictFound = true;
        state.whoFoundIt = foundBy;
        state.revisions.push(revisionResult.revision);
        state.conversation.push(...revisionResult.conversationTurns);
      }

      const validationTurns = runRevisionValidators({
        strategy,
        outputs,
        revisedSpecialistId: targetId,
        round,
      });
      conversation.push(...validationTurns);
      if (state) state.conversation.push(...validationTurns);

      if (issue.kind === "challenge") {
        issue.challenge.resolutionStatus = "resolved";
        issue.challenge.resolution = `Revised by ${targetId} in round ${round}`;
        allChallenges.push(issue.challenge);
      } else {
        crossReviewFindings.push({ ...issue.finding, resolved: false });
      }
    }

    crossReviewFindings = refreshCrossReviewResolution(
      crossReviewFindings,
      strategy,
      outputs,
      input.briefText,
      input.timelineContent
    );

    const stillOpen = countOpenCrossReviewFindings(
      getOpenCrossReviewFindings(strategy, outputs, input.briefText, input.timelineContent)
    );
    const stillOpenChallenges = detectConflicts({
      strategy,
      outputs,
      briefText: input.briefText,
      timelineContent: input.timelineContent,
    }).filter((c) => c.resolutionStatus === "open");

    if (stillOpen === 0 && stillOpenChallenges.length === 0) {
      break;
    }
  }

  crossReviewFindings = refreshCrossReviewResolution(
    crossReviewFindings,
    strategy,
    outputs,
    input.briefText,
    input.timelineContent
  );

  const openRemaining = countOpenCrossReviewFindings(crossReviewFindings);
  const directorApproved = openRemaining === 0;

  if (directorApproved) {
    const approvalTurn = turn(
      "director",
      "Approved — all specialist outputs revised and validated. Final versions ready for CampaignObject merge.",
      "approval",
      revisionRounds
    );
    conversation.push(approvalTurn);
  }

  const reviewReport = buildReviewReport({
    reviewStates,
    outputs,
    conversation,
    revisionRounds,
    directorApproved,
  });

  return {
    outputs,
    challenges: allChallenges,
    crossReviewFindings,
    revisionRounds,
    strategy,
    reviewReport,
    conversation,
  };
}

export function markSpecialistsApproved(outputs: SpecialistOutput[]): SpecialistOutput[] {
  return outputs.map((o) => ({
    ...o,
    status: o.status === "revised" || o.status === "reviewed" ? "approved" : o.status,
  }));
}

export { MAX_REVISION_ROUNDS };
