import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorPerformanceIntelligence } from "@/lib/enterprise-creator-intelligence/performance/types";

/**
 * Append-only Performance Intelligence capture.
 * Never updates prior history rows.
 */
export async function appendPerformanceIntelligenceCapture(
  supabase: SupabaseClient,
  intelligence: CreatorPerformanceIntelligence,
  options?: { source?: string; metadata?: Record<string, unknown> }
): Promise<{ ok: true; captureId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("creator_intelligence_performance_history")
    .insert({
      influencer_id: intelligence.influencerId,
      platform: intelligence.platform,
      captured_at: intelligence.computedAt,
      intelligence: intelligence as never,
      ai_hints: intelligence.aiHints as never,
      source: options?.source ?? "performance_compute",
      metadata: options?.metadata ?? {},
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.message ?? "Failed to append performance intelligence capture.",
    };
  }

  return { ok: true, captureId: (data as { id: string }).id };
}
