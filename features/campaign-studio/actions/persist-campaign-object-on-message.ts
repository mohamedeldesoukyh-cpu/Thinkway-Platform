import { revalidatePath } from "next/cache";

import {
  deserializeCampaignObject,
  serializeCampaignObject,
  type CampaignObject,
} from "@/features/campaign-intelligence";
import {
  getConversationWithMessages,
  updateMessageMetadata,
} from "@/features/ai-workspace/services/conversation-service";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireStudioUser() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    throw new Error(auth.error);
  }
  return { supabase, userId: auth.userId };
}

/**
 * Studio campaign objects live in the message metadata of the conversation —
 * load, patch, and write back the object for a given studio message.
 */
export async function persistCampaignObjectOnMessage(
  conversationId: string,
  messageId: string,
  userId: string,
  patch: (object: CampaignObject) => CampaignObject | Promise<CampaignObject>
): Promise<CampaignObject | null> {
  const { supabase } = await requireStudioUser();
  const conversation = await getConversationWithMessages(supabase, conversationId, userId);
  if (!conversation?.messages) return null;

  const message = conversation.messages.find((m) => m.id === messageId);
  if (!message?.metadata?.campaignObject) return null;

  const current = deserializeCampaignObject(
    message.metadata.campaignObject as Parameters<typeof deserializeCampaignObject>[0]
  );
  const next = await patch(current);
  const serialized = serializeCampaignObject(next);

  await updateMessageMetadata(supabase, messageId, {
    ...message.metadata,
    campaignObject: serialized,
  });

  revalidatePath(`/ai/${conversationId}`);
  return next;
}
