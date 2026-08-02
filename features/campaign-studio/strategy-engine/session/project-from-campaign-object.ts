import type { CampaignObject } from "@/features/campaign-intelligence";

import type { PlanningEntryPoint } from "../types/planning-entry";
import type { PlanningContext } from "../types/planning-context";

/**
 * Build a Planning Context handle that references Campaign Object.
 * Does not copy brief/budget/slate/media-plan/etc. onto the context.
 * Use `derivePlanningView` for read-only projections.
 */
export function createPlanningContextFromCampaignObject(input: {
  campaignObject: CampaignObject;
  entryPoint: PlanningEntryPoint;
  contextId?: string;
  campaignHeaderId?: string | null;
}): PlanningContext {
  return {
    contextId: input.contextId ?? `pc_${input.campaignObject.id}`,
    entryPoint: input.entryPoint,
    campaignObject: input.campaignObject,
    campaignHeaderId: input.campaignHeaderId ?? null,
  };
}

/**
 * @deprecated Alias — product name "Planning Session" = Planning Context handle.
 * Prefer createPlanningContextFromCampaignObject.
 */
export function projectPlanningSessionFromCampaignObject(input: {
  campaignObject: CampaignObject;
  entryPoint: PlanningEntryPoint;
  sessionId?: string;
  campaignHeaderId?: string | null;
}): PlanningContext {
  return createPlanningContextFromCampaignObject({
    campaignObject: input.campaignObject,
    entryPoint: input.entryPoint,
    contextId: input.sessionId,
    campaignHeaderId: input.campaignHeaderId,
  });
}
