import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { getCreatorRefreshPollStatus } from "@/lib/services/creators/creator-enrichment-service-shared";

/** Browse deliberately omits queue checks. Shortlists must retain actual in-flight states. */
export async function loadShortlistLiveStatuses(
  supabase: SupabaseClient<Database>,
  creators: Array<{ influencer_id: string | null; unified_id?: string | null } | null>,
) {
  const ids = [...new Set(creators.flatMap((creator) => {
    const id = creator?.influencer_id ?? (creator?.unified_id?.startsWith("inf:") ? creator.unified_id.slice(4) : null);
    return id ? [id] : [];
  }))];
  const statuses = new Map<string, NonNullable<UnifiedCreatorResult["enrichment_status"]>>();
  if (!ids.length) return statuses;
  const { data, error } = await supabase.from("influencers")
    .select("id, enrichment_status").in("id", ids).in("enrichment_status", ["queued", "running"]);
  if (error) throw new Error(error.message);
  const active = data ?? [];
  // Bound queue/DB concurrency when a large paste is still processing.
  for (let i = 0; i < active.length; i += 5) {
    await Promise.all(active.slice(i, i + 5).map(async (row) => {
      try {
        const poll = await getCreatorRefreshPollStatus(supabase, row.id);
        statuses.set(row.id, poll.enrichmentStatus ?? row.enrichment_status as "queued" | "running");
      } catch {
        // A queue outage must not hide a known pending job or break the shortlist page.
        statuses.set(row.id, row.enrichment_status as "queued" | "running");
      }
    }));
  }
  return statuses;
}
