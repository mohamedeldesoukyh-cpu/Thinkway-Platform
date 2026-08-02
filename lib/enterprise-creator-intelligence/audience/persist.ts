import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorAudienceIntelligence } from "@/lib/enterprise-creator-intelligence/audience/types";

/**
 * Append-only Audience Intelligence capture.
 * Never updates prior history rows.
 */
export async function appendAudienceIntelligenceCapture(
  supabase: SupabaseClient,
  intelligence: CreatorAudienceIntelligence,
  options?: { source?: string; metadata?: Record<string, unknown> }
): Promise<{ ok: true; captureId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("creator_intelligence_audience_history")
    .insert({
      influencer_id: intelligence.influencerId,
      platform: intelligence.platform,
      captured_at: intelligence.computedAt,
      intelligence: intelligence as never,
      ai_hints: intelligence.aiHints as never,
      source: options?.source ?? "audience_compute",
      metadata: options?.metadata ?? {},
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Failed to append audience intelligence capture.",
    };
  }

  return { ok: true, captureId: (data as { id: string }).id };
}
