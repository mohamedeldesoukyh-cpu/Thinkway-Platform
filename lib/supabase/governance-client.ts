import type { SupabaseClient } from "@supabase/supabase-js";

/** Escape hatch for governance tables not yet in generated Database types. */
export function governanceDb(supabase: SupabaseClient) {
  return supabase as SupabaseClient;
}
