import { isCampaignWorkflow } from "@/features/campaign-studio/constants/workflow-ids";

import type { AiMessage } from "../types";

/** True when a message carries a renderable campaign studio object. */
export function isStudioMessage(message: AiMessage): boolean {
  const metadata = message.metadata;
  return (
    message.role === "assistant" &&
    metadata?.workflow === true &&
    typeof metadata.workflowId === "string" &&
    isCampaignWorkflow(metadata.workflowId as string) &&
    Boolean(metadata.campaignObject)
  );
}

/** The most recent message that carries a campaign studio object, if any. */
export function findLatestStudioMessage(messages: AiMessage[]): AiMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (isStudioMessage(message)) return message;
  }
  return null;
}

/**
 * Invalidate Studio binding when timeline / Media Plan calendar patches land.
 * `id` + `updatedAt` alone can miss in-memory patches that share the prior timestamp.
 */
export function studioCampaignObjectBindKey(
  messageId: string | undefined,
  campaignObject: {
    id?: string;
    updatedAt?: string;
    meta?: {
      campaignFacts?: {
        scheduledStartDate?: string | null;
        requestedStartDate?: string | null;
        campaignStartDate?: string | null;
        durationWeeks?: number | null;
      };
      campaignOutputs?: {
        media_plan?: {
          version?: number;
          updatedAt?: string;
          content?: { data?: { campaignStartDate?: string; scheduledStartDate?: string } };
        };
      };
      copilotChangeLog?: unknown[];
    };
  } | null | undefined
): string {
  if (!campaignObject) return messageId ?? "";
  const facts = campaignObject.meta?.campaignFacts;
  const mediaPlan = campaignObject.meta?.campaignOutputs?.media_plan;
  const planData = mediaPlan?.content?.data;
  return [
    messageId ?? "",
    campaignObject.id ?? "",
    campaignObject.updatedAt ?? "",
    facts?.scheduledStartDate ?? "",
    facts?.requestedStartDate ?? "",
    facts?.campaignStartDate ?? "",
    facts?.durationWeeks ?? "",
    mediaPlan?.version ?? 0,
    mediaPlan?.updatedAt ?? "",
    planData?.scheduledStartDate ?? planData?.campaignStartDate ?? "",
    campaignObject.meta?.copilotChangeLog?.length ?? 0,
  ].join("|");
}
