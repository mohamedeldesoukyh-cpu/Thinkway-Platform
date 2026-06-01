import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BrandListItem } from "@/types/database";

import { brandListItemToTableRow, type BrandTableRow } from "./utils";

export async function getBrandsByClientId(
  clientId: string
): Promise<BrandTableRow[]> {
  const supabase = await createSupabaseServerClient();

  const [brandsResult, campaignsResult] = await Promise.all([
    supabase
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
      .order("name"),
    supabase
      .from("campaign_headers")
      .select("brand_id")
      .eq("client_id", clientId),
  ]);

  if (brandsResult.error) {
    throw new Error(brandsResult.error.message);
  }
  if (campaignsResult.error) {
    throw new Error(campaignsResult.error.message);
  }

  const campaignCountByBrand = new Map<string, number>();
  for (const row of campaignsResult.data ?? []) {
    const brandId = (row as { brand_id: string | null }).brand_id;
    if (!brandId) continue;
    campaignCountByBrand.set(brandId, (campaignCountByBrand.get(brandId) ?? 0) + 1);
  }

  return ((brandsResult.data ?? []) as BrandListItem[]).map((brand) =>
    brandListItemToTableRow(brand, campaignCountByBrand.get(brand.id) ?? 0)
  );
}

export type { BrandTableRow };
