import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorCategoryBrandIntelligence } from "@/lib/enterprise-creator-intelligence/category-brand/types";

/**
 * Append-only Category & Brand intelligence capture.
 * Never updates prior history rows.
 */
export async function appendCategoryBrandIntelligenceCapture(
  supabase: SupabaseClient,
  intelligence: CreatorCategoryBrandIntelligence,
  options?: { source?: string; metadata?: Record<string, unknown> }
): Promise<{ ok: true; captureId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("creator_intelligence_category_brand_history")
    .insert({
      influencer_id: intelligence.influencerId,
      platform: intelligence.platform,
      captured_at: intelligence.computedAt,
      intelligence: intelligence as never,
      ai_hints: intelligence.aiHints as never,
      source: options?.source ?? "category_brand_compute",
      metadata: options?.metadata ?? {},
    } as never)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.message ??
        "Failed to append category & brand intelligence capture.",
    };
  }

  return { ok: true, captureId: (data as { id: string }).id };
}
