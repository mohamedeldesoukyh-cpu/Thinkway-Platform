import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCreatorIntelligenceBundle } from "@/lib/enterprise-creator-intelligence/consumer";
import {
  computeCreatorInvestmentIntelligence,
  type CreatorInvestmentFacts,
} from "@/lib/enterprise-creator-intelligence/investment/compute";
import { appendInvestmentIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/investment/persist";
import type {
  CreatorInvestmentAiHints,
  CreatorInvestmentIntelligence,
} from "@/lib/enterprise-creator-intelligence/investment/types";
import type { EciFactsCache } from "@/lib/enterprise-creator-intelligence/shared/facts-cache";

/**
 * Load Creator Investment Intelligence via the platform SSOT facade (shared cache).
 * Never redesigns or recalculates prior layer engines.
 */
export async function loadCreatorInvestmentIntelligence(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
    persistCapture?: boolean;
    factsOverride?: CreatorInvestmentFacts;
    cache?: EciFactsCache;
  }
): Promise<CreatorInvestmentIntelligence> {
  if (input.factsOverride) {
    const current = computeCreatorInvestmentIntelligence(input.factsOverride);
    if (input.persistCapture) {
      await appendInvestmentIntelligenceCapture(supabase, current);
    }
    return current;
  }

  const bundle = await loadCreatorIntelligenceBundle(supabase, {
    influencerId: input.influencerId,
    platform: input.platform,
    cache: input.cache,
  });

  if (input.persistCapture) {
    await appendInvestmentIntelligenceCapture(supabase, bundle.investment);
  }

  return bundle.investment;
}

export function buildInvestmentAiHints(
  intelligence: CreatorInvestmentIntelligence
): CreatorInvestmentAiHints {
  return intelligence.aiHints;
}
