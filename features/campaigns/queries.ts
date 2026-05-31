import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getBrandsForCampaignForm,
  getMasterDataOptions,
} from "@/lib/master-data/queries";
import type { BrandFormOption } from "@/features/campaigns/types";
import type { CampaignListItem } from "@/types/database";

import { CAMPAIGNS_PAGE_SIZE } from "./constants";

export type CampaignsListResult = {
  campaigns: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CampaignFormOptions = {
  brands: BrandFormOption[];
  accountManagers: {
    id: string;
    full_name: string | null;
    email: string;
  }[];
  masterData: Awaited<ReturnType<typeof getMasterDataOptions>>;
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

export async function getCampaignsList(params: {
  page?: number;
  search?: string;
}): Promise<CampaignsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * CAMPAIGNS_PAGE_SIZE;
  const to = from + CAMPAIGNS_PAGE_SIZE - 1;

  const { supabase } = await requireUser();

  let query = supabase
    .from("campaign_headers")
    .select(
      `
      *,
      brand:brands(id, name),
      client:clients(id, name, document_number, legal_name),
      group:groups(id, name),
      account_manager:profiles!campaign_headers_account_manager_id_fkey(id, full_name, email),
      lines:campaign_lines(id, document_number, name, po_amount, revenue, cost, profit)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

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

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CAMPAIGNS_PAGE_SIZE));

  return {
    campaigns: (data ?? []) as CampaignListItem[],
    total,
    page,
    pageSize: CAMPAIGNS_PAGE_SIZE,
    totalPages,
  };
}

export async function getCampaignFormOptions(): Promise<CampaignFormOptions> {
  const { supabase } = await requireUser();

  const [brands, masterData, managersResult] = await Promise.all([
    getBrandsForCampaignForm(),
    getMasterDataOptions(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (managersResult.error) {
    throw new Error(managersResult.error.message);
  }

  return {
    brands: brands as BrandFormOption[],
    masterData,
    accountManagers: managersResult.data ?? [],
  };
}

export { getBrandHierarchySnapshot } from "@/lib/master-data/queries";
