import { isOperationalCampaignBrief } from "@/features/ai/routing/operational-detection";

/**
 * Chat stays chat unless the user asks to plan. Offer Studio when this thread
 * already has campaign state, or the last user turn is an operational brief
 * and Studio has not bound yet.
 */
export function shouldOfferOpenInStudio(input: {
  hasStudioMessage: boolean;
  lastUserMessage?: string | null;
  hasCampaignObject?: boolean;
}): boolean {
  if (input.hasStudioMessage) return false;
  if (input.hasCampaignObject) return true;
  const lastUser = input.lastUserMessage?.trim() ?? "";
  return lastUser.length > 0 && isOperationalCampaignBrief(lastUser);
}
