import type { CampaignOption, DebateScore, DirectorReview, OptionId } from "./debate-types";
import { DIRECTOR_ROLES } from "./leadership-debate";

/** Director weight for weighted scoring — Strategy and Performance carry slightly more weight. */
const DIRECTOR_WEIGHTS: Record<string, number> = {
  "Strategy Director": 1.2,
  "Media Director": 1.0,
  "Creator Director": 1.1,
  "Finance Director": 1.0,
  "Risk Director": 1.0,
  "Performance Director": 1.15,
  "Presentation Director": 0.95,
};

export function aggregateDebateScores(
  options: CampaignOption[],
  reviews: DirectorReview[]
): DebateScore[] {
  return options.map((option) => {
    const optionReviews = reviews.filter((r) => r.optionId === option.id);
    const directorScores = optionReviews.map((r) => ({
      role: r.directorRole,
      score: r.score,
      wouldApprove: r.wouldApprove,
    }));

    const rawTotal = directorScores.reduce((s, d) => s + d.score, 0);
    const averageScore = rawTotal / directorScores.length;

    let weightedSum = 0;
    let weightTotal = 0;
    for (const r of optionReviews) {
      const w = DIRECTOR_WEIGHTS[r.directorRole] ?? 1;
      weightedSum += r.score * w;
      weightTotal += w;
    }
    const weightedScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
    const approvalCount = optionReviews.filter((r) => r.wouldApprove).length;

    return {
      optionId: option.id,
      rawTotal,
      weightedScore: Math.round(weightedScore * 10) / 10,
      averageScore: Math.round(averageScore * 10) / 10,
      approvalCount,
      directorScores,
    };
  });
}

export function selectWinningOption(scores: DebateScore[]): OptionId {
  const sorted = [...scores].sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
    if (b.approvalCount !== a.approvalCount) return b.approvalCount - a.approvalCount;
    return b.averageScore - a.averageScore;
  });
  return sorted[0]?.optionId ?? "B";
}

export function getDirectorCount(): number {
  return DIRECTOR_ROLES.length;
}
