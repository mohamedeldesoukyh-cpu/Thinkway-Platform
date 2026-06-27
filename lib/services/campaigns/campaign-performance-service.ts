import type { SupabaseClient } from "@supabase/supabase-js";

import { countCampaignPublications } from "./repositories/publication-repository";

/** Performance orchestration entry points — workspace assembly remains in queries for Phase 3 Step 1. */
export async function getCampaignPublicationCount(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<number> {
  return countCampaignPublications(supabase, campaignHeaderId);
}
