import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeCreatorPerformanceIntelligence,
  type CreatorPerformanceFacts,
} from "@/lib/enterprise-creator-intelligence/performance/compute";
import { loadCreatorPerformanceFacts } from "@/lib/enterprise-creator-intelligence/performance/load-facts";
import { appendPerformanceIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/performance/persist";
import type {
  CreatorPerformanceAiHints,
  CreatorPerformanceIntelligence,
} from "@/lib/enterprise-creator-intelligence/performance/types";

export async function loadCreatorPerformanceIntelligence(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
    persistCapture?: boolean;
    factsOverride?: CreatorPerformanceFacts;
  }
): Promise<CreatorPerformanceIntelligence> {
  const facts =
    input.factsOverride ??
    (await loadCreatorPerformanceFacts(supabase, {
      influencerId: input.influencerId,
      platform: input.platform,
    }));

  const current = computeCreatorPerformanceIntelligence(facts);

  if (input.persistCapture) {
    await appendPerformanceIntelligenceCapture(supabase, current);
  }

  return current;
}

export function buildPerformanceAiHints(
  intelligence: CreatorPerformanceIntelligence
): CreatorPerformanceAiHints {
  return intelligence.aiHints;
}
