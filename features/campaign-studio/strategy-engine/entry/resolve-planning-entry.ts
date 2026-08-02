import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignSeed } from "@/features/campaign-outputs/hydration/hydration-types";
import { hydrateCampaignObject } from "@/features/campaign-outputs/hydration/hydrate";

import { createEmptyPlanningContext } from "../session/create-planning-session";
import { createPlanningContextFromCampaignObject } from "../session/project-from-campaign-object";
import {
  hydrationSourceToEntryPoint,
  type PlanningEntryInput,
  type PlanningEntryPoint,
} from "../types/planning-entry";
import type { PlanningContext } from "../types/planning-context";

export type ResolvePlanningEntryResult = {
  /** Planning Context (product alias: Planning Session). */
  session: PlanningContext;
  /** True when a new empty Campaign Object was created for this entry. */
  created: boolean;
  entryPoint: PlanningEntryPoint;
};

/**
 * Load or create a Planning Context from any planning entry point.
 * Never enforces workflow order. Never persists the context itself.
 */
export function resolvePlanningEntry(
  input: PlanningEntryInput,
  options?: {
    campaignObject?: CampaignObject;
    seed?: CampaignSeed;
  }
): ResolvePlanningEntryResult {
  const entryPoint = input.entryPoint;
  const campaignHeaderId =
    entryPoint === "existing_campaign" && "campaignHeaderId" in input
      ? input.campaignHeaderId
      : null;

  if (options?.campaignObject) {
    return {
      session: createPlanningContextFromCampaignObject({
        campaignObject: options.campaignObject,
        entryPoint,
        contextId:
          input.campaignObjectId != null
            ? `pc_${input.campaignObjectId}`
            : undefined,
        campaignHeaderId,
      }),
      created: false,
      entryPoint,
    };
  }

  if (options?.seed) {
    const empty = createEmptyPlanningContext({
      conversationId: input.conversationId,
      entryPoint: hydrationSourceToEntryPoint(options.seed.source),
      campaignHeaderId,
    });
    const hydrated = hydrateCampaignObject(options.seed, empty.campaignObject);
    return {
      session: createPlanningContextFromCampaignObject({
        campaignObject: hydrated.campaignObject,
        entryPoint,
        contextId: empty.contextId,
        campaignHeaderId,
      }),
      created: true,
      entryPoint,
    };
  }

  switch (entryPoint) {
    case "empty_session":
    case "ai_prompt":
    case "creator_discovery":
    case "media_plan":
    case "existing_campaign":
    case "quotation":
    case "creator_shortlist":
    case "campaign_brief": {
      const session = createEmptyPlanningContext({
        conversationId: input.conversationId,
        entryPoint,
        campaignHeaderId,
      });

      if (entryPoint === "campaign_brief" && "briefText" in input && input.briefText?.trim()) {
        const withBrief = {
          ...session.campaignObject,
          meta: {
            ...session.campaignObject.meta,
            campaignFacts: {
              extractedAt: new Date().toISOString(),
              confidence: {},
              sources: { objective: "brief" as const },
              rawBriefExcerpt: input.briefText.trim(),
            },
          },
        };
        return {
          session: createPlanningContextFromCampaignObject({
            campaignObject: withBrief,
            entryPoint,
            contextId: session.contextId,
            campaignHeaderId,
          }),
          created: true,
          entryPoint,
        };
      }

      if (
        (entryPoint === "creator_discovery" || entryPoint === "creator_shortlist") &&
        "creatorIds" in input &&
        input.creatorIds?.length
      ) {
        return {
          session: createPlanningContextFromCampaignObject({
            campaignObject: attachCreatorIds(session.campaignObject, input.creatorIds),
            entryPoint,
            contextId: session.contextId,
            campaignHeaderId,
          }),
          created: true,
          entryPoint,
        };
      }

      if (entryPoint === "ai_prompt" && "prompt" in input && input.prompt?.trim()) {
        const withPrompt = {
          ...session.campaignObject,
          meta: {
            ...session.campaignObject.meta,
            campaignFacts: {
              extractedAt: new Date().toISOString(),
              confidence: {},
              sources: {},
              rawBriefExcerpt: input.prompt.trim(),
            },
          },
        };
        return {
          session: createPlanningContextFromCampaignObject({
            campaignObject: withPrompt,
            entryPoint,
            contextId: session.contextId,
            campaignHeaderId,
          }),
          created: true,
          entryPoint,
        };
      }

      return { session, created: true, entryPoint };
    }
  }
}

function attachCreatorIds(
  campaignObject: CampaignObject,
  creatorIds: string[]
): CampaignObject {
  const now = new Date().toISOString();
  return {
    ...campaignObject,
    updatedAt: now,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        status: "working",
        updatedAt: now,
        data: {
          ...(campaignObject.sections.creators.data ?? {}),
          phase: "discovery",
          recommendations: {
            creatorIds,
            rationale: "Seeded from planning entry point",
          },
        },
      },
    },
  };
}

/** Convenience: Planning Context from an already-loaded Campaign Object. */
export function loadPlanningSessionFromCampaignObject(
  campaignObject: CampaignObject,
  entryPoint: PlanningEntryPoint = "empty_session",
  campaignHeaderId?: string | null
): PlanningContext {
  return createPlanningContextFromCampaignObject({
    campaignObject,
    entryPoint,
    campaignHeaderId,
  });
}
