"use server";

import { removeCreatorFromShortlistV2 } from "@/features/discovery/shortlists/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Remove a unified creator from one or more shortlists (session “Added” toggle).
 * Looks up shortlist item rows by unified_id / influencer_id / profile_id.
 */
export async function removeUnifiedCreatorFromShortlists(
  shortlistIds: string[],
  creator: {
    unified_id: string;
    influencer_id: string | null;
    discovered_profile_id: string | null;
  }
): Promise<{ removed: number; firstError: string | null }> {
  const uniqueShortlistIds = [...new Set(shortlistIds.filter(Boolean))];
  if (uniqueShortlistIds.length === 0) {
    return { removed: 0, firstError: "No shortlist to remove from." };
  }

  const supabase = await createSupabaseServerClient();
  let removed = 0;
  let firstError: string | null = null;

  for (const shortlistId of uniqueShortlistIds) {
    const lookups: Array<"unified_id" | "profile_id" | "influencer_id"> = [];
    if (creator.unified_id) lookups.push("unified_id");
    if (creator.discovered_profile_id) lookups.push("profile_id");
    if (creator.influencer_id) lookups.push("influencer_id");

    let itemId: string | null = null;
    for (const field of lookups) {
      let query = supabase
        .from("discovery_shortlist_items")
        .select("id")
        .eq("shortlist_id", shortlistId)
        .limit(1);
      if (field === "unified_id") query = query.eq("unified_id", creator.unified_id);
      if (field === "profile_id") query = query.eq("profile_id", creator.discovered_profile_id!);
      if (field === "influencer_id") query = query.eq("influencer_id", creator.influencer_id!);
      const { data: item } = await query.maybeSingle();
      if (item?.id) {
        itemId = item.id;
        break;
      }
    }
    if (!itemId) continue;

    const result = await removeCreatorFromShortlistV2(shortlistId, itemId);
    if (result.ok) {
      removed += 1;
    } else {
      firstError = firstError ?? result.message ?? "Failed to remove from shortlist.";
    }
  }

  return { removed, firstError };
}
