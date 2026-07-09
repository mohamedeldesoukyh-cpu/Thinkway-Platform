import type { CampaignStrategyDocument } from "../types";

/** Client-facing execution phases only — no internal agency schedule. */
export const CLIENT_FACING_TIMELINE_PHASES = [
  "Campaign Start",
  "Content Production",
  "Publishing Window",
  "Optimization",
  "Campaign End",
  "Reporting",
  "Insights",
  "Recommendations",
] as const;

/** Internal phases that must NOT appear in client-facing timeline. */
export const INTERNAL_TIMELINE_PATTERNS: RegExp[] = [
  /\bbrief\s*approval\b/i,
  /\binternal\s*approval/i,
  /\bvendor\s*discovery\b/i,
  /\bcreator\s*outreach\b/i,
  /\bdiscovery\b/i,
  /\bmeetings?\b/i,
  /\binternal\s*planning\b/i,
  /\bcompliance\s*review\b/i,
  /\bstrategy\s*approval\b/i,
  /\bkickoff\b/i,
  /\boutreach\b/i,
  /\bcurat/i,
];

export type ClientTimelineWeek = {
  week: number;
  phase: string;
  activities: string[];
  rationale: string;
};

function assignPhaseForWeek(
  week: number,
  durationWeeks: number
): { phase: string; activities: string[]; rationale: string } {
  if (week === 1) {
    return {
      phase: "Campaign Start",
      activities: ["Campaign kickoff", "Creator briefing aligned to strategy"],
      rationale: "Week 1 launches client-visible execution — no internal planning phases",
    };
  }

  const productionEnd = Math.max(2, Math.ceil(durationWeeks * 0.6));
  if (week <= productionEnd) {
    const tierNote =
      week === 2
        ? "Mega/Macro tier content"
        : week === productionEnd
          ? "Micro/Nano tier content"
          : "Multi-tier content production";
    return {
      phase: "Content Production",
      activities: [tierNote, "Brand review cycles"],
      rationale: `Tier progression per Director strategy — week ${week} of ${productionEnd}`,
    };
  }

  const publishWeek = productionEnd + 1;
  if (week === publishWeek && publishWeek < durationWeeks) {
    return {
      phase: "Publishing Window",
      activities: ["Scheduled publishing", "Real-time monitoring"],
      rationale: "Publishing aligned to platform mix and audience peak hours",
    };
  }

  if (week === durationWeeks) {
    return {
      phase: "Reporting",
      activities: ["Performance analysis", "Insights delivery", "Recommendations"],
      rationale: "Post-campaign reporting closes the client-facing execution window",
    };
  }

  if (week === durationWeeks - 1) {
    return {
      phase: "Optimization",
      activities: ["Content optimization", "Budget reallocation if needed"],
      rationale: "Optimization window before campaign end maximizes KPI delivery",
    };
  }

  return {
    phase: "Publishing Window",
    activities: ["Continued publishing", "Engagement monitoring"],
    rationale: "Sustained publishing maintains reach momentum toward KPI targets",
  };
}

export function buildClientTimelineFromStrategy(
  strategy: CampaignStrategyDocument
): ClientTimelineWeek[] {
  const durationWeeks = strategy.understanding.timeline?.durationWeeks ?? 6;
  const weeks: ClientTimelineWeek[] = [];

  for (let w = 1; w <= durationWeeks; w++) {
    const { phase, activities, rationale } = assignPhaseForWeek(w, durationWeeks);
    weeks.push({ week: w, phase, activities, rationale });
  }

  return weeks;
}

export function isInternalTimelinePhase(phase: string): boolean {
  return INTERNAL_TIMELINE_PATTERNS.some((pattern) => pattern.test(phase));
}

export function sanitizeToClientTimeline(text: string): string {
  const lines = text.split("\n");
  const sanitized: string[] = [];

  for (const line of lines) {
    const phaseMatch = line.match(/week\s*\d+[:\s-]+(.+)/i);
    const phaseText = phaseMatch?.[1] ?? line;
    if (isInternalTimelinePhase(phaseText)) continue;
    sanitized.push(line);
  }

  return sanitized.join("\n").trim();
}
