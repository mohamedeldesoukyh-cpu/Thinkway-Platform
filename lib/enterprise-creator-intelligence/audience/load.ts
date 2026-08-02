import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeCreatorAudienceIntelligence,
  type CreatorAudienceFacts,
} from "@/lib/enterprise-creator-intelligence/audience/compute";
import { loadCreatorAudienceFacts } from "@/lib/enterprise-creator-intelligence/audience/load-facts";
import { appendAudienceIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/audience/persist";
import type {
  CreatorAudienceAiHints,
  CreatorAudienceIntelligence,
} from "@/lib/enterprise-creator-intelligence/audience/types";

export async function loadCreatorAudienceIntelligence(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
    persistCapture?: boolean;
    factsOverride?: CreatorAudienceFacts;
  }
): Promise<CreatorAudienceIntelligence> {
  const facts =
    input.factsOverride ??
    (await loadCreatorAudienceFacts(supabase, {
      influencerId: input.influencerId,
      platform: input.platform,
    }));

  const current = computeCreatorAudienceIntelligence(facts);

  if (input.persistCapture) {
    await appendAudienceIntelligenceCapture(supabase, current);
  }

  return current;
}

export function buildAudienceAiHints(
  intelligence: CreatorAudienceIntelligence
): CreatorAudienceAiHints {
  return intelligence.aiHints;
}
