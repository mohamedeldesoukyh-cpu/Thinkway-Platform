import type { CampaignStudioSectionId } from "../types/campaign-studio";
import { STUDIO_WORKSPACE_STEPS } from "./studio-workspace";

/** Campaign Studio section layout types — three only. */
export const STUDIO_LAYOUT = {
  /** Timeline, Executive Strategy, Vendor Discovery, etc. — span full grid width. */
  full: [
    "executive-strategy",
    "creator-discovery",
    "creator-recommendations",
    "timeline",
    "creative-concepts",
    "content-plan",
    "industry-benchmark",
    "success-probability",
    "opportunity-finder",
    "executive-summary",
    "presentation-status",
  ] satisfies CampaignStudioSectionId[],
  /** KPI Forecast + Risk Analysis; Creator Mix + Thinkway Decision Rationale — half-width pairs. */
  pair: [
    "kpi-forecast",
    "risk-analysis",
    "creator-mix",
    "why-ai",
  ] satisfies CampaignStudioSectionId[],
  /** Campaign Summary, Budget Planner — full-width dashboard grids. */
  dashboard: ["campaign-summary", "budget-planner"] satisfies CampaignStudioSectionId[],
} as const;

export type StudioLayoutType = keyof typeof STUDIO_LAYOUT;

const LAYOUT_LOOKUP = new Map<CampaignStudioSectionId, StudioLayoutType>(
  (
    Object.entries(STUDIO_LAYOUT) as Array<[StudioLayoutType, CampaignStudioSectionId[]]>
  ).flatMap(([layout, ids]) => ids.map((id) => [id, layout]))
);

export function getSectionLayout(sectionId: CampaignStudioSectionId): StudioLayoutType {
  return LAYOUT_LOOKUP.get(sectionId) ?? "full";
}

export function isFullWidthSection(sectionId: CampaignStudioSectionId): boolean {
  return getSectionLayout(sectionId) !== "pair";
}

/**
 * Primary Studio navigation — six planning steps.
 * Folded section engines still exist on the Campaign Object; they are not
 * dumped into Package. Unknown future ids are omitted from the primary rail.
 */
export const STUDIO_STORY_ARC: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  sections: CampaignStudioSectionId[];
}> = STUDIO_WORKSPACE_STEPS.map((step) => ({
  id: step.id,
  label: step.label,
  description: step.question,
  sections: [...step.sections],
}));

export type StudioStoryPhase<TSection extends { id: CampaignStudioSectionId }> = {
  id: string;
  label: string;
  description: string;
  sections: TSection[];
};

/**
 * Group sections into the six workspace steps.
 * Folded / unmapped engines stay on the Campaign Object and are not appended
 * to Package — that would recreate the 17-card dump.
 */
export function groupSectionsByStoryPhase<TSection extends { id: CampaignStudioSectionId }>(
  sections: TSection[]
): Array<StudioStoryPhase<TSection>> {
  const byId = new Map(sections.map((s) => [s.id, s]));

  return STUDIO_STORY_ARC.map((phase) => {
    const phaseSections: TSection[] = [];
    for (const id of phase.sections) {
      const section = byId.get(id);
      if (section) phaseSections.push(section);
    }
    return { id: phase.id, label: phase.label, description: phase.description, sections: phaseSections };
  }).filter((phase) => phase.sections.length > 0);
}

/** Shared inner grid for KPI Forecast + Risk Analysis half-pair sections. */
export const PAIR_ANALYTICS_GRID =
  "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2";

export const PAIR_ANALYTICS_CARD =
  "min-w-0 overflow-hidden rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5";

/** Shared stack for Creator Mix + Thinkway Decision Rationale half-pair sections. */
export const PAIR_STRATEGY_STACK = "min-w-0 space-y-2";

export const PAIR_STRATEGY_CARD =
  "min-w-0 overflow-hidden rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5";

/** Full-width dashboard inner grids. */
export const DASHBOARD_SUMMARY_GRID =
  "grid min-w-0 w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export const DASHBOARD_BUDGET_TOP =
  "grid min-w-0 w-full gap-4 lg:grid-cols-[minmax(7rem,9rem)_1fr] lg:items-start";
