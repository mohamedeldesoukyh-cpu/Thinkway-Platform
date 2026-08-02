import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorCommercialIntelligence } from "@/lib/enterprise-creator-intelligence/commercial/types";

/**
 * Append-only commercial intelligence capture.
 * Never updates prior history rows.
 */
export async function appendCommercialIntelligenceCapture(
  supabase: SupabaseClient,
  intelligence: CreatorCommercialIntelligence,
  options?: { source?: string; metadata?: Record<string, unknown> }
): Promise<{ ok: true; captureId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("creator_intelligence_commercial_history")
    .insert({
      influencer_id: intelligence.influencerId,
      platform: intelligence.platform,
      captured_at: intelligence.computedAt,
      currency_code: intelligence.currencyCode,
      metrics: intelligence.metrics as never,
      ai_hints: intelligence.aiHints as never,
      source: options?.source ?? "commercial_compute",
      metadata: options?.metadata ?? {},
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Failed to append commercial intelligence capture.",
    };
  }

  return { ok: true, captureId: (data as { id: string }).id };
}
