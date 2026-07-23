"use server";

import { z } from "zod";

import {
  attachCampaignObjectToSnapshot,
  loadCampaignObjectForConversation,
  type CampaignObject,
} from "@/features/campaign-intelligence";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import { updateConversationContextSnapshot } from "@/features/ai-workspace/services/conversation-service";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  applyInfluencerConceptsPatch,
  type InfluencerConceptsMeta,
} from "../influencer-concepts";

const metaSchema = z.object({
  concepts: z.array(z.record(z.string(), z.unknown())).optional(),
  approvedConceptIds: z.array(z.string()).optional(),
  uploads: z
    .array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        uploadedAt: z.string(),
        mimeType: z.string().optional(),
        storagePath: z.string().optional(),
      })
    )
    .optional(),
  libraryTags: z
    .object({
      brand: z.string().optional(),
      industry: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

const inputSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  influencerConcepts: metaSchema,
});

export type UpdateInfluencerConceptsResult =
  | { ok: true; campaignObject: CampaignObject; change: string }
  | { ok: false; message: string };

/** Persist approved/edited influencer concepts on campaign object meta. */
export async function updateInfluencerConceptsAction(
  input: z.infer<typeof inputSchema>
): Promise<UpdateInfluencerConceptsResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid influencer concepts update." };
  }

  const { campaignObjectId, conversationId, influencerConcepts } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: conversationRow } = await supabase
    .from("ai_conversations")
    .select("context_snapshot")
    .eq("id", conversationId)
    .maybeSingle();

  const row = conversationRow as {
    context_snapshot?: Record<string, unknown> | null;
  } | null;

  const contextSnapshot = (row?.context_snapshot ?? {}) as Record<string, unknown>;
  const restored = await loadCampaignObjectForConversation(
    supabase,
    conversationId,
    contextSnapshot
  );

  if (!restored || restored.id !== campaignObjectId) {
    return { ok: false, message: "Campaign object not found." };
  }

  const updated = applyInfluencerConceptsPatch(
    restored,
    influencerConcepts as Partial<InfluencerConceptsMeta>
  );

  const saved = await saveCampaignObject(conversationId, updated, {
    supabase,
    userId: auth.userId,
    persistToDb: true,
    saveReason: "manual",
  });

  try {
    await updateConversationContextSnapshot(
      supabase,
      conversationId,
      auth.userId,
      attachCampaignObjectToSnapshot(contextSnapshot, saved)
    );
  } catch {
    /* studio message carries the object */
  }

  return {
    ok: true,
    campaignObject: saved,
    change: "Updated influencer concepts",
  };
}
