import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Post-import search visibility hook. `search_vector` on influencers / discovered_profiles
 * is maintained by DB triggers; no materialized view rebuild is required.
 */
export async function refreshDiscoverySearchAfterImport(
  _supabase: SupabaseClient
): Promise<void> {
  console.log(
    "[discovery] search index refresh complete — creator rows are live-queryable via search_creators"
  );
}
