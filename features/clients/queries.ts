import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBrandsByClientId } from "@/features/brands/queries";
import type { ClientDetail, ClientRow } from "@/types/database";

import { CLIENTS_PAGE_SIZE } from "./constants";

export type ClientsListResult = {
  clients: (ClientRow & { group: { id: string; name: string } | null })[];
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

export async function getClientsList(params: {
  page?: number;
  search?: string;
}): Promise<ClientsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * CLIENTS_PAGE_SIZE;
  const to = from + CLIENTS_PAGE_SIZE - 1;

  const { supabase } = await requireUser();

  let query = supabase
    .from("clients")
    .select("*, group:groups(id, name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `name_ar.ilike.${pattern}`,
        `legal_name.ilike.${pattern}`,
        `document_number.ilike.${pattern}`,
      ].join(",")
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;

  return {
    clients: (data ?? []) as unknown as ClientsListResult["clients"],
    total,
    page,
    pageSize: CLIENTS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)),
  };
}

export async function getClientById(id: string): Promise<ClientDetail | null> {
  const { supabase } = await requireUser();

  const { data: client, error } = await supabase
    .from("clients")
    .select(
      "*, group:groups(id, name, document_number), vr_rate:md_vr_rates(id, name, rate_percent)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!client) {
    return null;
  }

  const clientRow = client as unknown as ClientRow & {
    group: ClientDetail["group"];
    vr_rate: { id: string; name: string; rate_percent: number } | null;
  };

  const [documentsResult, campaignsResult, brands] = await Promise.all([
    supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("campaign_headers")
      .select(
        "id, name, document_number, status, currency_code, start_date, end_date, brand:brands(id, name)"
      )
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    getBrandsByClientId(id),
  ]);

  if (documentsResult.error) {
    throw new Error(documentsResult.error.message);
  }
  if (campaignsResult.error) {
    throw new Error(campaignsResult.error.message);
  }

  const { vr_rate, ...clientWithoutJoin } = clientRow;

  return {
    ...clientWithoutJoin,
    group: clientRow.group,
    vr_rate_percent: vr_rate?.rate_percent ?? null,
    documents: documentsResult.data ?? [],
    campaigns: (campaignsResult.data ?? []) as unknown as ClientDetail["campaigns"],
    brands,
  };
}
