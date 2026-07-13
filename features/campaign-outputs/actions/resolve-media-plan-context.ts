"use server";

import { z } from "zod";

import { loadCampaignObjectForConversation } from "@/features/campaign-intelligence/services/campaign-object-store";
import { enrichCampaignObjectQuotationContext } from "@/features/campaign-outputs/hydration/enrich-quotation-commercials-context";
import {
  resolveMediaPlanCampaignContext,
  type MediaPlanCampaignContext,
} from "@/features/campaign-outputs/generators/media-plan";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
});

/**
 * Resolve Group / Brand / Agency for Media Plan preview at panel-open time.
 * Reads the live quotation (with client/campaign group fallbacks) so chips render
 * without requiring a manual quotation re-sync.
 */
export async function resolveMediaPlanContextForPreview(
  input: z.infer<typeof inputSchema>
): Promise<MediaPlanCampaignContext> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return {};

  const { campaignObjectId, conversationId } = parsed.data;
  if (!conversationId) return {};

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) return {};

  const { data: conversationRow } = await supabase
    .from("ai_conversations")
    .select("workspace_type, workspace_id, context_snapshot")
    .eq("id", conversationId)
    .maybeSingle();

  const row = conversationRow as {
    workspace_type?: string;
    workspace_id?: string | null;
    context_snapshot?: Record<string, unknown> | null;
  } | null;

  const contextSnapshot = (row?.context_snapshot ?? {}) as Record<string, unknown>;
  const restored = await loadCampaignObjectForConversation(
    supabase,
    conversationId,
    contextSnapshot
  );

  if (!restored || restored.id !== campaignObjectId) return {};

  const enriched = await enrichCampaignObjectQuotationContext(supabase, restored, {
    workspaceType: row?.workspace_type,
    workspaceId: row?.workspace_id ?? undefined,
  });

  return resolveMediaPlanCampaignContext(enriched);
}
