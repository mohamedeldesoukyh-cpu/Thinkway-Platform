import type { SupabaseClient } from "@supabase/supabase-js";

/** Verify the user can see this brand via brands RLS (active only). */
export async function assertAccessibleBrandId(
  supabase: SupabaseClient,
  brandId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = brandId.trim();
  if (!id) {
    return { ok: false, message: "Select a brand to continue." };
  }

  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!data) {
    return {
      ok: false,
      message: "You do not have access to the selected brand. Pick another brand or contact your admin.",
    };
  }

  return { ok: true };
}
