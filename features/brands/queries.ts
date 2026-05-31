import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BrandListItem } from "@/types/database";

export async function getBrandsByClientId(clientId: string): Promise<BrandListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("brands")
    .select(
      `
      *,
      category:md_categories(id, name),
      subcategory:md_subcategories(id, name),
      vr_rate:md_vr_rates(id, name, rate_percent)
    `
    )
    .eq("client_id", clientId)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BrandListItem[];
}
