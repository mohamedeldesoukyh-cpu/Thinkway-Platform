/**
 * Planning entry points — any may open/update the same Planning Session.
 * Never enforce a linear workflow.
 */

export const PLANNING_ENTRY_POINTS = [
  "campaign_brief",
  "ai_prompt",
  "creator_discovery",
  "creator_shortlist",
  "media_plan",
  "quotation",
  "existing_campaign",
  "empty_session",
] as const;

export type PlanningEntryPoint = (typeof PLANNING_ENTRY_POINTS)[number];

export type PlanningEntryInput =
  | { entryPoint: "campaign_brief"; briefText?: string; conversationId?: string; campaignObjectId?: string }
  | { entryPoint: "ai_prompt"; prompt?: string; conversationId?: string; campaignObjectId?: string }
  | {
      entryPoint: "creator_discovery";
      creatorIds?: string[];
      conversationId?: string;
      campaignObjectId?: string;
    }
  | {
      entryPoint: "creator_shortlist";
      shortlistId?: string;
      creatorIds?: string[];
      conversationId?: string;
      campaignObjectId?: string;
    }
  | {
      entryPoint: "media_plan";
      conversationId?: string;
      campaignObjectId?: string;
    }
  | {
      entryPoint: "quotation";
      quotationId?: string;
      conversationId?: string;
      campaignObjectId?: string;
    }
  | {
      entryPoint: "existing_campaign";
      campaignHeaderId?: string;
      conversationId?: string;
      campaignObjectId?: string;
    }
  | {
      entryPoint: "empty_session";
      conversationId?: string;
      campaignObjectId?: string;
    };

/** Maps legacy hydration seeds → Planning entry points (no workflow lock). */
export function hydrationSourceToEntryPoint(
  source:
    | "campaign_brief"
    | "creator_shortlist"
    | "quotation"
    | "discovery_selection"
    | "existing_campaign"
    | "crm_campaign"
    | "manual_wizard"
): PlanningEntryPoint {
  switch (source) {
    case "campaign_brief":
      return "campaign_brief";
    case "creator_shortlist":
      return "creator_shortlist";
    case "quotation":
      return "quotation";
    case "discovery_selection":
      return "creator_discovery";
    case "existing_campaign":
    case "crm_campaign":
      return "existing_campaign";
    case "manual_wizard":
      return "empty_session";
  }
}
