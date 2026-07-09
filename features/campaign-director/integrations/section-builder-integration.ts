import type { BudgetSectionData, TimelineSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignObjectSections } from "@/features/campaign-intelligence/types/campaign-object";

import type { CampaignStrategyDocument, DirectorPipelineResult } from "../types";
import { buildDirectorBudgetFromStrategy } from "../services/budget-rules";
import { buildClientTimelineFromStrategy } from "../services/timeline-rules";

/** Merge Director WHY rationale into section data extras. */
export function enrichSectionsWithDirectorRationale(
  sections: CampaignObjectSections,
  pipeline: DirectorPipelineResult
): CampaignObjectSections {
  const rationaleBySection = new Map(
    pipeline.approvedSections.map((s) => [s.sectionKey, s.rationale])
  );

  const enriched = { ...sections };

  for (const key of Object.keys(enriched) as Array<keyof CampaignObjectSections>) {
    const section = enriched[key];
    const rationale = rationaleBySection.get(key);
    if (!rationale) continue;

    enriched[key] = {
      ...section,
      data: {
        ...section.data,
        directorRationale: rationale,
        why: rationale,
      },
    };
  }

  return enriched;
}

/** Apply Director budget rules — influencer model, 100% allocation, rationale on each line. */
export function applyDirectorBudgetRules(
  budget: BudgetSectionData,
  strategy: CampaignStrategyDocument,
  briefText: string,
  campaignFacts?: import("../facts/campaign-facts-types").CampaignFacts
): BudgetSectionData {
  const directorBudget = buildDirectorBudgetFromStrategy(strategy, briefText, campaignFacts);

  return {
    ...directorBudget,
    allocations: directorBudget.allocations.map((line) => ({
      ...line,
      notes: line.notes ?? budget.allocations.find((a) => a.category === line.category)?.notes,
    })),
    notes: directorBudget.notes ?? budget.notes,
  };
}

/** Apply Director timeline rules — client-facing phases only with rationale. */
export function applyDirectorTimelineRules(
  timeline: TimelineSectionData,
  strategy: CampaignStrategyDocument
): TimelineSectionData {
  const clientWeeks = buildClientTimelineFromStrategy(strategy);

  return {
    durationWeeks: strategy.understanding.timeline?.durationWeeks ?? timeline.durationWeeks,
    milestones: clientWeeks.map((w) => ({
      week: w.week,
      phase: w.phase,
      activities: w.activities,
      status: "pending" as const,
    })),
    goLiveWeek: timeline.goLiveWeek,
  };
}
