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
