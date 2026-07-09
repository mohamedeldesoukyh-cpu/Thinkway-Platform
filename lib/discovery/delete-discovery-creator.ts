import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCreatorDeleteBlockers,
  type CreatorDeleteLinkRef,
} from "@/lib/discovery/creator-delete-blockers";

export type DeleteDiscoveryCreatorResult =
  | { ok: true; message: string }
  | { ok: false; message: string; links?: CreatorDeleteLinkRef[] };

export type DiscoveryCreatorDeleteEligibility = {
  canDelete: boolean;
  message: string;
  links: CreatorDeleteLinkRef[];
};

export async function getDiscoveryCreatorDeleteEligibility(
  supabase: SupabaseClient,
  influencerId: string
): Promise<DiscoveryCreatorDeleteEligibility> {
  const blockers = await getCreatorDeleteBlockers(supabase, influencerId);
  return {
    canDelete: blockers.canDelete,
    message: blockers.message,
    links: blockers.links,
  };
}

export async function deleteDiscoveryCreator(
  supabase: SupabaseClient,
  influencerId: string
): Promise<DeleteDiscoveryCreatorResult> {
  const eligibility = await getDiscoveryCreatorDeleteEligibility(supabase, influencerId);
  if (!eligibility.canDelete) {
    return {
      ok: false,
      message: eligibility.message,
      links: eligibility.links,
    };
  }

  const { error: shortlistItemsError } = await supabase
    .from("discovery_shortlist_items")
    .delete()
    .eq("influencer_id", influencerId);

  if (shortlistItemsError) {
    return { ok: false, message: shortlistItemsError.message };
  }

  const { error: deleteError } = await supabase
    .from("influencers")
    .delete()
    .eq("id", influencerId);

  if (deleteError) {
    return {
      ok: false,
      message:
        deleteError.message ||
        "Could not delete creator — it may be linked to protected records.",
    };
  }

  return { ok: true, message: "Creator removed from Thinkway." };
}
