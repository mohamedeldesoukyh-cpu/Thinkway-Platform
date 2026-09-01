import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";

import type { PostPerformanceAnalysis } from "./post-performance";
import type { CreatorFacingRecommendation, CreatorInsightPack, UpcomingCreatorUnit } from "./types";

export function upcomingUnitsFromViews(units: readonly CreatorUnitView[]): UpcomingCreatorUnit[] {
  return units.map((unit) => ({
    campaignHeaderId: unit.campaignHeaderId,
    assignmentDeliverableId: unit.assignmentDeliverableId,
    assignmentPostScheduleId: unit.assignmentPostScheduleId,
    deliverableType: unit.deliverableType,
    platform: unit.platform,
    status: unit.status,
    label: unit.label,
  }));
}

export function compactInsightForUnit(
  pack: CreatorInsightPack,
  unit: Pick<
    CreatorUnitView,
    "assignmentDeliverableId" | "assignmentPostScheduleId" | "campaignHeaderId"
  >
): string | null {
  return analysisForUnit(pack, unit)?.title ?? matchUnitInsightLine(pack, unit);
}

export function analysisForUnit(
  pack: CreatorInsightPack,
  unit: Pick<
    CreatorUnitView,
    "assignmentDeliverableId" | "assignmentPostScheduleId" | "campaignHeaderId"
  >
): PostPerformanceAnalysis | null {
  const match = pack.postAnalyses.find((row) => {
    if (row.assignmentDeliverableId !== unit.assignmentDeliverableId) return false;
    if (row.campaignHeaderId && row.campaignHeaderId !== unit.campaignHeaderId) return false;
    if (unit.assignmentPostScheduleId) {
      return row.assignmentPostScheduleId === unit.assignmentPostScheduleId;
    }
    return true;
  });
  return match ?? null;
}

function matchUnitInsightLine(
  pack: CreatorInsightPack,
  unit: Pick<
    CreatorUnitView,
    "assignmentDeliverableId" | "assignmentPostScheduleId" | "campaignHeaderId"
  >
): string | null {
  const match = pack.unitInsights.find((row) => {
    if (row.assignmentDeliverableId !== unit.assignmentDeliverableId) return false;
    if (row.campaignHeaderId && row.campaignHeaderId !== unit.campaignHeaderId) return false;
    if (unit.assignmentPostScheduleId) {
      return row.assignmentPostScheduleId === unit.assignmentPostScheduleId;
    }
    return true;
  });
  return match?.line ?? null;
}

export function campaignInsightLine(
  pack: CreatorInsightPack,
  campaignHeaderId: string
): string | null {
  const rec = pack.recommendations.find(
    (row) => row.campaignHeaderId === campaignHeaderId && row.type === "campaign_specific"
  );
  return rec?.title ?? null;
}

export function creatorHomeInsightCards(
  pack: CreatorInsightPack
): CreatorFacingRecommendation[] {
  return pack.recommendations.slice(0, 3);
}

export { type CreatorInsightPack };
