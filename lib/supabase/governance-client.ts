import type { SupabaseClient } from "@supabase/supabase-js";

/** Escape hatch for governance tables not yet in generated Database types. */
export function governanceDb(supabase: SupabaseClient) {
  return supabase as SupabaseClient;
}

/** Planning tables (budget_versions, forecast_versions, etc.) pending Database codegen. */
export function planningDb(supabase: SupabaseClient) {
  return supabase as SupabaseClient;
}
