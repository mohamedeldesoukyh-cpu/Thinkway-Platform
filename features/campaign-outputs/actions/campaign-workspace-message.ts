/**
 * Pure helpers for opening a Campaign workspace from a business page.
 *
 * The studio-message metadata here is intentionally the SAME shape the chat
 * route writes for a Copilot edit (workflow + campaign workflowId +
 * serialized campaign object), so the existing studio renders it and the
 * existing Copilot picks it up. No new model, no duplicate rendering path.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { serializeCampaignObject } from "@/features/campaign-intelligence";
import { CREATE_CAMPAIGN_WORKFLOW_ID } from "@/features/campaign-studio/constants/workflow-ids";

export type StudioTab = "studio" | "outputs" | "director";

/** Metadata that makes an assistant message render as a Campaign Studio. */
export function buildStudioMessageMetadata(campaignObject: CampaignObject): Record<string, unknown> {
  return {
    agentId: "campaign-copilot",
    workflow: true,
    workflowId: campaignObject.workflowId ?? CREATE_CAMPAIGN_WORKFLOW_ID,
    workflowName: "Campaign Studio",
    workflowStatus: "complete",
    campaignObject: serializeCampaignObject(campaignObject),
  };
}

export type CopilotAssistantMetadataOptions = {
  intentKind: string;
  /** True when the campaign object was mutated and a new version was persisted. */
  changed: boolean;
  outputNavigate?: string;
  outputPreview?: string;
};

/**
 * Metadata for a Campaign Copilot assistant turn.
 *
 * Always carries the authoritative `campaignObject` so the Outputs Center and
 * Studio bind to the same registry the Copilot loaded (DB / context snapshot),
 * not a stale workflow seed message. `changed` only gates version persistence.
 */
export function buildCopilotAssistantMetadata(
  campaignObject: CampaignObject,
  options: CopilotAssistantMetadataOptions
): Record<string, unknown> {
  return {
    ...buildStudioMessageMetadata(campaignObject),
    copilotIntent: options.intentKind,
    ...(options.changed ? { copilotEdit: true } : { studioSync: true }),
    ...(options.outputNavigate ? { outputNavigate: options.outputNavigate } : {}),
    ...(options.outputPreview ? { outputPreview: options.outputPreview } : {}),
  };
}

/** The workspace URL, optionally deep-linked to a mounted tab. */
export function workspaceHref(conversationId: string, tab: StudioTab = "studio"): string {
  return tab === "studio" ? `/ai/${conversationId}` : `/ai/${conversationId}?studioTab=${tab}`;
}
