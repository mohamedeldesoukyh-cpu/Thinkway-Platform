import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeCreatorCategoryBrandIntelligence,
  type CreatorCategoryBrandFacts,
} from "@/lib/enterprise-creator-intelligence/category-brand/compute";
import { loadCreatorCategoryBrandFacts } from "@/lib/enterprise-creator-intelligence/category-brand/load-facts";
import { appendCategoryBrandIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/category-brand/persist";
import type {
  CategoryBrandHistoryCapture,
  CreatorCategoryBrandAiHints,
  CreatorCategoryBrandIntelligence,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";
import { isMissingTableError } from "@/lib/platform/schema-validation";

async function loadPriorLifetimeCounts(
  supabase: SupabaseClient,
  influencerId: string
): Promise<Map<string, number> | null> {
  const { data, error } = await supabase
    .from("creator_intelligence_category_brand_history")
    .select("intelligence, captured_at")
    .eq("influencer_id", influencerId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message, error.code)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  const intelligence = (data as { intelligence?: CreatorCategoryBrandIntelligence })
    .intelligence;
  const lifetime = intelligence?.windows?.lifetime?.categories ?? [];
  if (lifetime.length === 0) return null;
  return new Map(lifetime.map((c) => [c.category, c.postCount]));
}

export async function loadCreatorCategoryBrandIntelligence(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
    persistCapture?: boolean;
    factsOverride?: CreatorCategoryBrandFacts;
  }
): Promise<{
  current: CreatorCategoryBrandIntelligence;
  historyCount: number;
}> {
  const priorLifetimeCategoryCounts = await loadPriorLifetimeCounts(
    supabase,
    input.influencerId
  );

  const facts =
    input.factsOverride ??
    (await loadCreatorCategoryBrandFacts(supabase, {
      influencerId: input.influencerId,
      platform: input.platform,
    }));

  const current = computeCreatorCategoryBrandIntelligence({
    ...facts,
    priorLifetimeCategoryCounts,
  });

  if (input.persistCapture) {
    await appendCategoryBrandIntelligenceCapture(supabase, current);
  }

  const { count } = await supabase
    .from("creator_intelligence_category_brand_history")
    .select("id", { count: "exact", head: true })
    .eq("influencer_id", input.influencerId);

  return { current, historyCount: count ?? 0 };
}

export function buildCategoryBrandAiHints(
  intelligence: CreatorCategoryBrandIntelligence
): CreatorCategoryBrandAiHints {
  return intelligence.aiHints;
}

export type { CategoryBrandHistoryCapture };
