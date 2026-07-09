import type { CampaignOption, DebateScore, DirectorMeetingDecision, DirectorReview, OptionId } from "./debate-types";
import { selectWinningOption } from "./debate-scorer";

function buildRejectionReasons(
  loserId: OptionId,
  option: CampaignOption,
  reviews: DirectorReview[],
  scores: DebateScore[]
): string[] {
  const optionReviews = reviews.filter((r) => r.optionId === loserId);
  const score = scores.find((s) => s.optionId === loserId);
  const reasons: string[] = [];

  reasons.push(
    `Weighted score ${score?.weightedScore ?? 0}/100 with ${score?.approvalCount ?? 0}/7 director approvals — below winning threshold.`
  );

  const rejectReviews = optionReviews.filter((r) => !r.wouldApprove);
  for (const r of rejectReviews.slice(0, 3)) {
    reasons.push(`${r.directorRole}: ${r.weakness}`);
  }

  if (option.archetype === "max_reach") {
    reasons.push("Macro/Mega-heavy reach plan rejected — insufficient UGC volume and trust transfer for brief objective.");
  } else if (option.archetype === "balanced") {
    reasons.push("Balanced middle-path rejected — lacks decisive engagement advantage over reach-first alternative.");
  }

  return reasons;
}

/** Campaign Director meeting — receives all reviews, documents winner and rejection reasons. */
export function runDirectorMeeting(
  options: CampaignOption[],
  reviews: DirectorReview[],
  scores: DebateScore[]
): DirectorMeetingDecision {
  const winnerId = selectWinningOption(scores);
  const winner = options.find((o) => o.id === winnerId)!;
  const losers = options.filter((o) => o.id !== winnerId);

  const rejectionReasons = losers.map((loser) => ({
    optionId: loser.id,
    reasons: buildRejectionReasons(loser.id, loser, reviews, scores),
  }));

  const winnerScore = scores.find((s) => s.optionId === winnerId);
  const winnerReviews = reviews.filter((r) => r.optionId === winnerId && r.wouldApprove);

  const directorConclusion = [
    `Campaign Director approves Option ${winnerId} (${winner.label}) — weighted score ${winnerScore?.weightedScore ?? 0}/100,`,
    `${winnerScore?.approvalCount ?? 0}/7 director approvals.`,
    winner.strategySlice,
    `Rejected: ${losers.map((l) => `Option ${l.id} (${l.label})`).join("; ")}.`,
  ].join(" ");

  const meetingSummary = [
    "Agency Leadership Debate — 7 directors reviewed 3 complete options (A Max Reach, B Balanced, C Max Engagement).",
    `Winner: Option ${winnerId} (${winner.label}) — ${winner.creatorTierStrategy.map((t) => `${t.tier} ${t.allocationPercent}%`).join(" · ")}.`,
    ...rejectionReasons.map(
      (r) =>
        `Option ${r.optionId} rejected: ${r.reasons[0]}`
    ),
    `Key approvals: ${winnerReviews.slice(0, 3).map((r) => `${r.directorRole} (${r.score})`).join(", ")}.`,
  ].join("\n");

  return {
    winnerId,
    winnerLabel: winner.label,
    approved: true,
    rejectionReasons,
    directorConclusion,
    meetingSummary,
  };
}
