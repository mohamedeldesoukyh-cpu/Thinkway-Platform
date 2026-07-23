import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

import { generateRefreshRecommendations } from "./recommendation-engine";
import type { CreatorRecommendationReport } from "./recommendation-types";

export type AutonomousIntelligenceAssessment = Readonly<{
  creatorId: string;
  needsRefresh: boolean;
  priorityScore: number;
  report: CreatorRecommendationReport;
}>;

/** Evaluates a single creator snapshot for proactive refresh needs — no execution. */
export function assessCreatorIntelligenceNeeds(
  snapshot: CreatorIntelligenceSnapshot
): AutonomousIntelligenceAssessment | null {
  const creatorId = snapshot.creatorId ?? snapshot.influencerId;
  if (!creatorId) return null;

  const report = generateRefreshRecommendations({ snapshot });
  const priorityScore =
    report.recommendations.length === 0
      ? 0
      : Math.max(...report.recommendations.map((rec) => rec.priority));

  return Object.freeze({
    creatorId,
    needsRefresh: report.recommendations.length > 0,
    priorityScore,
    report,
  });
}

/** Ranks multiple creators by refresh priority — recommendations only. */
export function rankCreatorsByRefreshPriority(
  snapshots: readonly CreatorIntelligenceSnapshot[]
): readonly AutonomousIntelligenceAssessment[] {
  return Object.freeze(
    snapshots
      .map((snapshot) => assessCreatorIntelligenceNeeds(snapshot))
      .filter((item): item is AutonomousIntelligenceAssessment => item !== null)
      .filter((item) => item.needsRefresh)
      .sort((a, b) => b.priorityScore - a.priorityScore)
  );
}
