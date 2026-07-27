import { isCampaignWorkflow } from "@/features/campaign-studio/constants/workflow-ids";

import type { AiMessage } from "../types";

const LOG_PREFIX = "[studio-bind]";
const ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEBUG_STUDIO_BIND === "1";

/** Studio binding diagnostics — which object the panel renders and why. */
export function logStudioBindEvent(
  event: string,
  detail?: Record<string, unknown>
): void {
  if (!ENABLED) return;
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  console.log(`${LOG_PREFIX} ${event}${payload}`);
}

/**
 * Mirror of isStudioMessage (campaign-studio-panel-utils) that names every
 * failing predicate, so a null findLatestStudioMessage() is explainable
 * message-by-message instead of silently rendering the streaming skeleton.
 */
export function describeStudioMessageCandidate(message: AiMessage): string {
  const metadata = message.metadata as Record<string, unknown> | undefined;
  const reasons: string[] = [];
  if (message.role !== "assistant") reasons.push("role!=assistant");
  if (metadata?.workflow !== true) reasons.push("metadata.workflow!==true");
  if (typeof metadata?.workflowId !== "string") {
    reasons.push("metadata.workflowId missing");
  } else if (!isCampaignWorkflow(metadata.workflowId)) {
    reasons.push(`workflowId=${metadata.workflowId} is not a campaign workflow`);
  }
  if (!metadata?.campaignObject) reasons.push("metadata.campaignObject missing");
  return reasons.length === 0 ? "QUALIFIES" : reasons.join("; ");
}
