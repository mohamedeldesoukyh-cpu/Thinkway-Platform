import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorInvestmentIntelligence } from "@/lib/enterprise-creator-intelligence/investment/types";

/**
 * Append-only Creator Investment Intelligence capture.
 * Never updates prior history rows.
 */
export async function appendInvestmentIntelligenceCapture(
  supabase: SupabaseClient,
  intelligence: CreatorInvestmentIntelligence,
  options?: { source?: string; metadata?: Record<string, unknown> }
): Promise<{ ok: true; captureId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("creator_intelligence_investment_history")
    .insert({
      influencer_id: intelligence.influencerId,
      platform: intelligence.platform,
      captured_at: intelligence.computedAt,
      overall_score: intelligence.overallScore,
      recommendation: intelligence.recommendation.recommendation,
      intelligence: intelligence as never,
      ai_hints: intelligence.aiHints as never,
      source: options?.source ?? "investment_compute",
      metadata: options?.metadata ?? {},
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Failed to append investment intelligence capture.",
    };
  }

  return { ok: true, captureId: (data as { id: string }).id };
}
