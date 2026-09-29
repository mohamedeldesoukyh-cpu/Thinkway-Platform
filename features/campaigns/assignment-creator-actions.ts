"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import { unifiedToInfluencerSearch } from "@/lib/creators/adapters";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import { enqueueCreatorEnrichmentBestEffort } from "@/lib/creator-enrichment/queue";
import { priorityForTrigger } from "@/lib/creator-enrichment/policy";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import { shouldAutoEnrichForTrigger } from "@/lib/discovery/control-center/discovery-control-policy";

/** Resolve an authoritative identity, using the same promotion and enrichment pipeline as shortlists. */
export async function selectAssignmentCreator(unifiedId: string) {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) return { ok: false as const, message: auth.error };
  let creator = await getUnifiedCreatorById(supabase, unifiedId);
  if (!creator) return { ok: false as const, message: "Creator not found. Search again." };
  if (!creator.influencer_id && creator.discovered_profile_id) {
    const promoted = await promoteDiscoveredProfileToInfluencer(supabase, creator.discovered_profile_id, auth.userId);
    if (!promoted.ok) return promoted;
    creator = await getUnifiedCreatorById(supabase, `inf:${promoted.influencerId}`);
  }
  const influencer = creator && unifiedToInfluencerSearch(creator);
  if (!influencer) return { ok: false as const, message: "This creator could not be prepared for assignment." };
  const settings = await getDiscoveryControlSettings(supabase);
  if (shouldAutoEnrichForTrigger("campaign", settings)) {
    enqueueCreatorEnrichmentBestEffort({ influencerId: influencer.id, trigger: "campaign", scope: "all", priority: priorityForTrigger("campaign"), force: false });
  }
  return { ok: true as const, influencer };
}
