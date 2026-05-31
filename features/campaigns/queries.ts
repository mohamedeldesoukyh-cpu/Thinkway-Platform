import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  clients: { id: string; name: string }[];
  accountManagers: {
    id: string;
    full_name: string | null;
    email: string;
  }[];
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
    .from("campaigns")
    .select(
      `
      *,
      client:clients(id, name, document_number),
      account_manager:profiles!campaigns_account_manager_id_fkey(id, full_name, email)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;

    const { data: matchingClients } = await supabase
      .from("clients")
      .select("id")
      .ilike("name", pattern);

    const clientIds = matchingClients?.map((client) => client.id) ?? [];
    const orFilters = [
      `name.ilike.${pattern}`,
      `document_number.ilike.${pattern}`,
    ];

    if (clientIds.length > 0) {
      orFilters.push(`client_id.in.(${clientIds.join(",")})`);
    }

    query = query.or(orFilters.join(","));
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

  const [clientsResult, managersResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (clientsResult.error) {
    throw new Error(clientsResult.error.message);
  }

  if (managersResult.error) {
    throw new Error(managersResult.error.message);
  }

  return {
    clients: clientsResult.data ?? [],
    accountManagers: managersResult.data ?? [],
  };
}
