import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";

import type { PlanningEntryPoint } from "../types/planning-entry";
import type { PlanningContext } from "../types/planning-context";
import { createPlanningContextFromCampaignObject } from "./project-from-campaign-object";

function newIds(conversationId?: string): {
  contextId: string;
  campaignObjectId: string;
} {
  const stamp = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    contextId: `pc_${stamp}`,
    campaignObjectId: conversationId
      ? `co_${conversationId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}_${stamp}`
      : `co_${stamp}`,
  };
}

/**
 * Create an empty Planning Context bound to a new Campaign Object.
 * No Planning Context persistence — only the Campaign Object is the durable artifact.
 */
export function createEmptyPlanningContext(input?: {
  conversationId?: string;
  entryPoint?: PlanningEntryPoint;
  campaignHeaderId?: string | null;
}): PlanningContext {
  const entryPoint = input?.entryPoint ?? "empty_session";
  const { contextId, campaignObjectId } = newIds(input?.conversationId);
  const campaignObject = createEmptyCampaignObject({
    id: campaignObjectId,
    conversationId: input?.conversationId,
  });

  return createPlanningContextFromCampaignObject({
    campaignObject,
    entryPoint,
    contextId,
    campaignHeaderId: input?.campaignHeaderId,
  });
}

/** @deprecated Prefer createEmptyPlanningContext — same orchestration handle. */
export const createEmptyPlanningSession = createEmptyPlanningContext;
