import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BrandListItem } from "@/types/database";

import { BRANDS_PAGE_SIZE } from "./constants";
import {
  brandListItemToTableRow,
  type BrandTableRow,
  type BrandsListRow,
} from "./utils";

export type BrandsListResult = {
  brands: BrandsListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to continue.");
  }

  return { supabase, user };
}

export async function getBrandsList(params: {
  page?: number;
  search?: string;
}): Promise<BrandsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * BRANDS_PAGE_SIZE;
  const to = from + BRANDS_PAGE_SIZE - 1;

  const { supabase } = await requireUser();

  let query = supabase
    .from("brands")
    .select(
      `
      *,
      category:md_categories(id, name),
      subcategory:md_subcategories(id, name),
      vr_rate:md_vr_rates(id, name, rate_percent),
      client:clients(id, name, legal_name),
      group:groups(id, name)
    `,
      { count: "exact" }
    )
    .order("name");

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const brandIds = (data ?? []).map((row) => row.id);
  const campaignCountByBrand = new Map<string, number>();

  if (brandIds.length > 0) {
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaign_headers")
      .select("brand_id")
      .in("brand_id", brandIds);

    if (campaignsError) {
      throw new Error(campaignsError.message);
    }

    for (const row of campaigns ?? []) {
      const brandId = (row as { brand_id: string | null }).brand_id;
      if (!brandId) continue;
      campaignCountByBrand.set(brandId, (campaignCountByBrand.get(brandId) ?? 0) + 1);
    }
  }

  const brands: BrandsListRow[] = ((data ?? []) as unknown as (BrandListItem & {
    client: { id: string; name: string; legal_name: string | null } | null;
    group: { id: string; name: string } | null;
  })[]).map((brand) => ({
    ...brandListItemToTableRow(brand, campaignCountByBrand.get(brand.id) ?? 0),
    client_name: brand.client?.name ?? "—",
    group_name: brand.group?.name ?? null,
  }));

  const total = count ?? 0;

  return {
    brands,
    total,
    page,
    pageSize: BRANDS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / BRANDS_PAGE_SIZE)),
  };
}

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

  return ((brandsResult.data ?? []) as unknown as BrandListItem[]).map((brand) =>
    brandListItemToTableRow(brand, campaignCountByBrand.get(brand.id) ?? 0)
  );
}

export type { BrandTableRow };
