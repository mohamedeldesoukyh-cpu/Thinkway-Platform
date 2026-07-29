"use server";

import { z } from "zod";

import { loadCampaignObjectForConversation } from "@/features/campaign-intelligence";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { requirePermission } from "@/lib/auth/permissions-server";
import { resolveCampaignHeaderIdForMediaPlan } from "@/lib/media-plan/log-media-plan-timeline";
import { performanceFactsFromAssignmentHierarchy } from "@/lib/media-plan/performance-facts";
import type { MediaPlanPerformanceFact } from "@/lib/media-plan/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
});

export type LoadMediaPlanPerformanceFactsResult =
  | { ok: true; facts: MediaPlanPerformanceFact[] }
  | { ok: false; message: string };

/**
 * Load Performance live-date facts for Studio Media Plan card coloring.
 * Same source as Campaign Original / Actual views.
 */
export async function loadMediaPlanPerformanceFactsAction(
  input: z.infer<typeof inputSchema>
): Promise<LoadMediaPlanPerformanceFactsResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { campaignObjectId, conversationId, campaignId } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: conversationRow } = await supabase
    .from("ai_conversations")
    .select("context_snapshot")
    .eq("id", conversationId)
    .maybeSingle();

  const contextSnapshot = ((conversationRow as { context_snapshot?: Record<string, unknown> | null } | null)
    ?.context_snapshot ?? {}) as Record<string, unknown>;

  const restored = await loadCampaignObjectForConversation(
    supabase,
    conversationId,
    contextSnapshot
  );
  if (!restored || restored.id !== campaignObjectId) {
    return { ok: false, message: "Campaign object not found." };
  }

  const headerId = await resolveCampaignHeaderIdForMediaPlan(
    supabase,
    campaignObjectId,
    campaignId
  );
  if (!headerId) {
    return { ok: true, facts: [] };
  }

  try {
    const hierarchy = await getCampaignAssignmentHierarchy(headerId);
    return {
      ok: true,
      facts: performanceFactsFromAssignmentHierarchy(hierarchy),
    };
  } catch {
    return { ok: true, facts: [] };
  }
}
