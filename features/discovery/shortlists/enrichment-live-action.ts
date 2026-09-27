"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCreatorFromRefLookup, resolveUnifiedCreatorsByRefs } from "@/lib/creators/unified-browse";
import { SHORTLIST_PERMISSIONS } from "./constants";
import { loadShortlistLiveStatuses } from "./enrichment-live-status";

/** Read only the requested rows belonging to an accessible shortlist, using session RLS. */
export async function getShortlistEnrichmentUpdates(shortlistId: string, itemIds: string[]) {
  if (!shortlistId || itemIds.length === 0 || itemIds.length > 100) {
    throw new Error("Invalid shortlist enrichment request.");
  }
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.read);
  if ("error" in auth) throw new Error(auth.error);
  const { data: shortlist, error: shortlistError } = await supabase
    .from("discovery_shortlists").select("id").eq("id", shortlistId).maybeSingle();
  if (shortlistError || !shortlist) throw new Error("Shortlist is not accessible.");

  const { data, error } = await supabase.from("discovery_shortlist_items")
    .select("id, unified_id, influencer_id, profile_id")
    .eq("shortlist_id", shortlistId).in("id", itemIds);
  if (error) throw new Error(error.message);
  const items = data ?? [];
  // Read job state before metrics so completion cannot stop polling on an older snapshot.
  const statuses = await loadShortlistLiveStatuses(supabase, items);
  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: items.map((item) => item.unified_id),
    influencerIds: items.map((item) => item.influencer_id),
    discoveredProfileIds: items.map((item) => item.profile_id),
  }, { skipDna: false, omitHeavyFields: false });
  return items.flatMap((item) => {
    const creator = resolveCreatorFromRefLookup(lookup, item);
    const status = creator?.influencer_id ? statuses.get(creator.influencer_id) : null;
    return creator ? [{ unifiedId: item.unified_id ?? creator.unified_id,
      creator: status ? { ...creator, enrichment_status: status } : creator }] : [];
  });
}
