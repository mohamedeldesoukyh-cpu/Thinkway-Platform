/**
 * Deliverable input extraction — the read side of the dependency graph.
 *
 * Every input key maps to a normalized, JSON-serializable slice of the Campaign
 * Object. The same values feed both the fingerprint (staleness detection) and
 * the generators, so a deliverable and its "Needs Update" flag always agree on
 * what "the inputs" are. This module is intentionally self-contained (no Copilot
 * imports) so the Deliverables Engine has no cycle with the Copilot.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  PerformanceSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { DeliverableInputKey } from "./deliverable-types";

/** One creator on the slate, resolved from the object's own reasoning (no hydration). */
export type SlateCreator = {
  creatorId: string;
  displayName: string;
  tier?: string;
};

function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

/** Resolve the current creator slate as name + tier from the Campaign Object alone. */
export function resolveSlate(campaignObject: CampaignObject): SlateCreator[] {
  const creatorsData = (campaignObject.sections.creators?.data ?? {}) as CreatorsSectionData;
  const ids = creatorsData.recommendations?.creatorIds ?? [];
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  const byId = new Map(reasoning.map((r) => [normalizeId(r.creatorId), r]));
  return ids.map((id) => {
    const entry = byId.get(normalizeId(id));
    return {
      creatorId: id,
      displayName: entry?.displayName?.trim() || id,
      tier: entry?.expectedRole?.trim() || undefined,
    };
  });
}

function stringContent(campaignObject: CampaignObject, section: keyof CampaignObject["sections"]): string {
  const content = campaignObject.sections[section]?.content;
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    try {
      return JSON.stringify(content);
    } catch {
      return "";
    }
  }
  return "";
}

export function overallScore(campaignObject: CampaignObject): number | undefined {
  const performance = campaignObject.sections.performance?.data as
    | PerformanceSectionData
    | undefined;
  return performance?.campaignScores?.overall;
}

/**
 * The normalized value for one input key. Returns plain JSON-serializable data;
 * order is normalized (ids sorted) so a fingerprint is stable across reorderings
 * that don't change the actual slate.
 */
export function resolveInputValue(
  campaignObject: CampaignObject,
  key: DeliverableInputKey
): unknown {
  const facts = getCampaignFacts(campaignObject);
  switch (key) {
    case "objective":
      return facts?.objective ?? "";
    case "audience":
      return facts?.audience ?? "";
    case "market":
      return [...(facts?.geography ?? [])].sort();
    case "platforms":
      return facts?.platforms ?? [];
    case "creators":
      return resolveSlate(campaignObject)
        .map((c) => `${normalizeId(c.creatorId)}:${(c.tier ?? "").toLowerCase()}`)
        .sort();
    case "budget":
      return facts?.budget ? { amount: facts.budget.amount, currency: facts.budget.currency } : null;
    case "timeline":
      return facts?.durationWeeks ?? null;
    case "kpis":
      return facts?.kpis ?? [];
    case "deliverables_scope":
      return facts?.deliverables ?? [];
    case "strategy":
      return stringContent(campaignObject, "strategy");
    case "creative_concepts":
      // Creative concepts live in the strategy section's data in the current model.
      return stringContent(campaignObject, "strategy").slice(0, 4000);
    case "risks":
      return [...(facts?.risks ?? [])].sort();
    default:
      return null;
  }
}
