import type { CampaignObject } from "@/features/campaign-intelligence";
import type { StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";
import type {
  CampaignOutputInputKey,
  CampaignOutputKind,
} from "@/features/campaign-outputs/output-types";
import {
  describeStaleReason,
  listCampaignOutputs,
  regeneratableStaleCampaignOutputKinds,
} from "@/features/campaign-outputs/output-registry";
import { summarizeStaleCause } from "@/features/campaign-outputs/output-stale-reason";

import type { CampaignStudioSectionId } from "../types/campaign-studio";
import { outdatedSectionsForDraft } from "./studio-draft";

/**
 * Studio sections that must show Outdated when campaign facts change.
 * Strategy · Discovery · Mix · Content · Commercial · Timeline · Proposal · Presentation.
 */
export const FACTS_FRESHNESS_STUDIO_SECTIONS: readonly CampaignStudioSectionId[] = [
  "executive-strategy",
  "creator-discovery",
  "creator-mix",
  "content-plan",
  "budget-planner",
  "timeline",
  "executive-summary",
  "presentation-status",
];

/** Map a changed Campaign Object input to the Studio cards that consume it. */
const FACT_INPUT_TO_STUDIO_SECTIONS: Record<
  CampaignOutputInputKey,
  readonly CampaignStudioSectionId[]
> = {
  timeline: FACTS_FRESHNESS_STUDIO_SECTIONS,
  budget: [
    "budget-planner",
    "creator-mix",
    "creator-recommendations",
    "content-plan",
    "kpi-forecast",
    "executive-strategy",
    "executive-summary",
    "presentation-status",
  ],
  objective: [
    "executive-strategy",
    "campaign-summary",
    "why-ai",
    "creator-discovery",
    "executive-summary",
  ],
  audience: [
    "executive-strategy",
    "creator-discovery",
    "creator-recommendations",
    "executive-summary",
  ],
  market: ["creator-discovery", "executive-strategy", "industry-benchmark"],
  platforms: ["content-plan", "creative-concepts", "creator-mix", "creator-discovery"],
  creators: [
    "creator-discovery",
    "creator-recommendations",
    "creator-mix",
    "content-plan",
    "budget-planner",
  ],
  brief: ["campaign-summary", "executive-strategy", "executive-summary"],
  kpis: ["kpi-forecast", "success-probability", "executive-summary"],
  strategy: ["executive-strategy", "why-ai", "opportunity-finder", "risk-analysis"],
  creative_concepts: ["creative-concepts"],
  risks: ["risk-analysis"],
  deliverables_scope: ["content-plan"],
  market_intelligence: ["industry-benchmark", "opportunity-finder"],
};

/** Map a stale generated output to the Studio cards that surface the same artifact. */
const OUTPUT_KIND_TO_STUDIO_SECTIONS: Partial<
  Record<CampaignOutputKind, readonly CampaignStudioSectionId[]>
> = {
  full_strategy: ["executive-strategy", "executive-summary", "why-ai", "opportunity-finder"],
  executive_summary: ["executive-summary"],
  executive_proposal: ["executive-summary", "presentation-status"],
  client_presentation: ["presentation-status"],
  media_plan: ["timeline", "creator-mix", "budget-planner"],
  content_calendar: ["content-plan", "timeline"],
  posting_timeline: ["timeline"],
  creator_activation: ["creator-mix", "creator-recommendations", "timeline"],
  kpi_forecast: ["kpi-forecast"],
  risk_plan: ["risk-analysis"],
  budget_allocation: ["budget-planner"],
  amplification_plan: ["content-plan", "budget-planner"],
  creative_concepts: ["creative-concepts"],
  campaign_brief: ["campaign-summary"],
};

function addSections(
  target: Set<CampaignStudioSectionId>,
  sectionIds: readonly CampaignStudioSectionId[] | undefined
): void {
  if (!sectionIds) return;
  for (const sectionId of sectionIds) target.add(sectionId);
}

/**
 * Studio cards that are Outdated because generated outputs (or their input
 * fingerprints) no longer match Campaign Facts. Reuses the Outputs Engine —
 * does not invent a parallel stale graph.
 */
export function outdatedStudioSectionsFromOutputs(
  campaignObject: CampaignObject
): Set<CampaignStudioSectionId> {
  const outdated = new Set<CampaignStudioSectionId>();
  for (const view of listCampaignOutputs(campaignObject)) {
    if (view.status !== "needs_update") continue;
    addSections(outdated, OUTPUT_KIND_TO_STUDIO_SECTIONS[view.kind]);
    const staleInputs = describeStaleReason(campaignObject, view.kind)?.staleInputs ?? [];
    for (const key of staleInputs) {
      addSections(outdated, FACT_INPUT_TO_STUDIO_SECTIONS[key]);
    }
  }
  return outdated;
}

/** Union of slate/refresh draft outdated + facts/output-fingerprint outdated. */
export function outdatedStudioSections(
  campaignObject: CampaignObject | undefined,
  draft: StudioDraftState
): Set<CampaignStudioSectionId> {
  const outdated = outdatedSectionsForDraft(draft);
  if (!campaignObject) return outdated;
  for (const sectionId of outdatedStudioSectionsFromOutputs(campaignObject)) {
    outdated.add(sectionId);
  }
  return outdated;
}

export type StudioFreshnessSummary = {
  staleOutputCount: number;
  regeneratableCount: number;
  outdatedSectionCount: number;
  cause: string;
  showBanner: boolean;
};

/** Studio banner state derived from the live output registry. */
export function studioFreshnessSummary(
  campaignObject: CampaignObject | undefined,
  outdatedSections: Set<CampaignStudioSectionId>
): StudioFreshnessSummary {
  if (!campaignObject) {
    return {
      staleOutputCount: 0,
      regeneratableCount: 0,
      outdatedSectionCount: outdatedSections.size,
      cause: "after campaign inputs changed",
      showBanner: outdatedSections.size > 0,
    };
  }

  const outputs = listCampaignOutputs(campaignObject);
  const staleOutputCount = outputs.filter((view) => view.status === "needs_update").length;
  const regeneratableCount = regeneratableStaleCampaignOutputKinds(campaignObject).length;
  const outdatedSectionCount = outdatedSections.size;

  return {
    staleOutputCount,
    regeneratableCount,
    outdatedSectionCount,
    cause: summarizeStaleCause(outputs),
    showBanner: staleOutputCount > 0 || outdatedSectionCount > 0,
  };
}
