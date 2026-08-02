import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { PlanningCapabilityId } from "../types/planning-capability";
import type { PlanningCapabilityPatch } from "../types/planning-capability";
import type { PlanningContext, PlanningStatus } from "../types/planning-context";
import { assertCapabilityMayWrite } from "../registry/capability-registry";
import { createPlanningContextFromCampaignObject } from "./project-from-campaign-object";

function applyPlanningStatusToCampaignObject(
  object: CampaignObject,
  status: PlanningStatus | undefined,
  now: string
): CampaignObject["meta"] {
  if (!status) return object.meta;
  const meta = { ...object.meta };
  switch (status) {
    case "in_progress":
    case "draft":
      meta.status = "building";
      break;
    case "ready_for_review":
      meta.status = "complete";
      meta.workflowStatus = "complete";
      break;
    case "in_review":
      (meta as { lifecycleStatus?: string }).lifecycleStatus = "in_review";
      break;
    case "approved":
    case "frozen":
      (meta as { lifecycleStatus?: string }).lifecycleStatus = "approved";
      break;
    default:
      break;
  }
  void now;
  return meta;
}

/**
 * Apply a capability patch by mutating Campaign Object only.
 * Returns an updated Planning Context (same orchestration handle shape).
 * Never stores brief/budget/proposal/etc. on the context itself.
 * Media Plan schedule is never written here — use lib/media-plan.
 */
export function applyPlanningCapabilityPatch(input: {
  /** Planning Context (product alias: Planning Session). */
  session: PlanningContext;
  capabilityId: PlanningCapabilityId;
  patch: PlanningCapabilityPatch;
}): PlanningContext {
  assertCapabilityMayWrite(input.capabilityId, input.patch);

  const object = input.session.campaignObject;
  const facts = getCampaignFacts(object) ?? {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
  const patch = input.patch;
  const now = new Date().toISOString();

  const nextFacts = {
    ...facts,
    ...(patch.objectives != null ? { objective: patch.objectives } : {}),
    ...(patch.audience != null ? { audience: patch.audience } : {}),
    ...(patch.brief != null ? { rawBriefExcerpt: patch.brief } : {}),
    ...(patch.markets ? { geography: patch.markets } : {}),
    ...(patch.platforms ? { platforms: patch.platforms } : {}),
    ...(patch.budget !== undefined
      ? {
          budget:
            patch.budget == null
              ? undefined
              : {
                  amount: patch.budget.amount ?? 0,
                  currency: patch.budget.currency ?? "USD",
                },
        }
      : {}),
    ...(patch.kpis ? { kpis: patch.kpis } : {}),
    ...(patch.brandName != null ? { brandName: patch.brandName ?? undefined } : {}),
    ...(patch.clientName != null ? { clientName: patch.clientName ?? undefined } : {}),
  };

  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  const nextCreatorsData: CreatorsSectionData | undefined =
    patch.creatorIds != null
      ? {
          ...creatorsData,
          phase: creatorsData.phase ?? "discovery",
          recommendations: {
            ...(creatorsData.recommendations ?? {}),
            creatorIds: patch.creatorIds,
            rationale:
              creatorsData.recommendations?.rationale ??
              "Updated via Strategy Engine capability",
          },
        }
      : undefined;

  const nextMeta = applyPlanningStatusToCampaignObject(object, patch.planningStatus, now);

  const nextObject: CampaignObject = {
    ...object,
    updatedAt: now,
    meta: {
      ...nextMeta,
      campaignFacts: nextFacts,
      // Preserve Media Plan SSOT pointers unchanged.
      mediaPlanSchedule: object.meta.mediaPlanSchedule,
      mediaPlanLifecycle: object.meta.mediaPlanLifecycle,
      mediaPlanIdentity: object.meta.mediaPlanIdentity,
      mediaPlanPresentation: object.meta.mediaPlanPresentation,
      campaignOutputs: object.meta.campaignOutputs,
    },
    sections: {
      ...object.sections,
      ...(patch.strategyNarrative != null
        ? {
            strategy: {
              ...object.sections.strategy,
              content: patch.strategyNarrative,
              updatedAt: now,
              status: patch.strategyNarrative.trim()
                ? "complete"
                : object.sections.strategy.status,
            },
          }
        : {}),
      ...(patch.presentation != null || patch.proposal != null
        ? {
            presentation: {
              ...object.sections.presentation,
              content:
                patch.presentation ??
                patch.proposal ??
                object.sections.presentation.content,
              updatedAt: now,
              status: "complete",
            },
          }
        : {}),
      ...(patch.audience != null
        ? {
            audience: {
              ...object.sections.audience,
              content: patch.audience,
              updatedAt: now,
              status: patch.audience.trim()
                ? "complete"
                : object.sections.audience.status,
            },
          }
        : {}),
      ...(nextCreatorsData
        ? {
            creators: {
              ...object.sections.creators,
              status: "working",
              updatedAt: now,
              data: nextCreatorsData,
            },
          }
        : {}),
    },
  };

  return createPlanningContextFromCampaignObject({
    campaignObject: nextObject,
    entryPoint: input.session.entryPoint,
    contextId: input.session.contextId,
    campaignHeaderId: input.session.campaignHeaderId,
  });
}
