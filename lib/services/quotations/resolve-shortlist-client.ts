import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Older shortlists store only the brand; use its recorded client, just like the shortlist page. */
export async function resolveShortlistClient<T extends { client_id: string | null; brand_id: string | null }>(
  supabase: SupabaseClient<Database>, row: T,
) {
  if (row.client_id || !row.brand_id) return { data: row, error: null };
  const brand = await supabase.from("brands").select("client_id").eq("id", row.brand_id).single();
  if (brand.error) return { data: null, error: brand.error };
  return { data: { ...row, client_id: brand.data.client_id }, error: null };
}
