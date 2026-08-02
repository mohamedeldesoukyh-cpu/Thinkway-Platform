import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type {
  PlanningContext,
  PlanningDerivedView,
  PlanningStatus,
} from "../types/planning-context";

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function contentString(section: { content?: unknown } | undefined): string | null {
  if (!section) return null;
  if (typeof section.content === "string") return asString(section.content);
  return null;
}

function mapPlanningStatus(
  campaignObject: PlanningContext["campaignObject"]
): PlanningStatus {
  const lifecycle = (campaignObject.meta as { lifecycleStatus?: string }).lifecycleStatus;
  const workflow = campaignObject.meta.workflowStatus;
  if (lifecycle === "approved" || lifecycle === "published") return "frozen";
  if (lifecycle === "in_review") return "in_review";
  if (campaignObject.meta.status === "complete" || workflow === "complete") {
    return "ready_for_review";
  }
  if (campaignObject.meta.status === "building") return "in_progress";
  const facts = getCampaignFacts(campaignObject);
  const creators = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const hasSignal =
    Boolean(facts?.objective) ||
    Boolean(facts?.rawBriefExcerpt) ||
    (creators.recommendations?.creatorIds?.length ?? 0) > 0 ||
    Boolean(campaignObject.meta.mediaPlanSchedule);
  return hasSignal ? "draft" : "empty";
}

/**
 * Derive a read-only planning view from Campaign Object.
 * Callers must treat this as ephemeral projection — never persist as a document.
 */
export function derivePlanningView(context: PlanningContext): PlanningDerivedView {
  const { campaignObject } = context;
  const facts = getCampaignFacts(campaignObject);
  const creators = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const mix = creators.slateIntelligence?.actualMix ?? [];

  return {
    contextId: context.contextId,
    entryPoint: context.entryPoint,
    campaignObjectId: campaignObject.id,
    conversationId: campaignObject.conversationId,
    campaignHeaderId: context.campaignHeaderId ?? null,
    planningStatus: mapPlanningStatus(campaignObject),
    brief: facts?.rawBriefExcerpt ?? contentString(campaignObject.sections.summary),
    objectives: facts?.objective ?? null,
    audience: facts?.audience ?? contentString(campaignObject.sections.audience),
    markets: facts?.geography ?? [],
    platforms: facts?.platforms ?? [],
    budget: facts?.budget
      ? { amount: facts.budget.amount, currency: facts.budget.currency }
      : null,
    kpis: facts?.kpis ?? [],
    mediaMix: mix.map((t) => ({
      tier: t.tier,
      percent: t.percent,
      count: t.count,
    })),
    creatorIds: creators.recommendations?.creatorIds ?? [],
    strategyNarrative: contentString(campaignObject.sections.strategy),
    presentation: contentString(campaignObject.sections.presentation),
    mediaPlan: {
      attached: Boolean(
        campaignObject.meta.mediaPlanSchedule || campaignObject.meta.mediaPlanLifecycle
      ),
      hasSchedule: Boolean(campaignObject.meta.mediaPlanSchedule),
      hasLifecycle: Boolean(campaignObject.meta.mediaPlanLifecycle),
      campaignObjectId: campaignObject.id,
    },
    hasOutputsRegistry: Boolean(campaignObject.meta.campaignOutputs),
  };
}
