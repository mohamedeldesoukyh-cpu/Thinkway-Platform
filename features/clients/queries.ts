import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClientDetail, ClientRow } from "@/types/database";

import { CLIENTS_PAGE_SIZE } from "./constants";

export type ClientsListResult = {
  clients: ClientRow[];
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
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `legal_name.ilike.${pattern}`,
        `document_number.ilike.${pattern}`,
        `industry.ilike.${pattern}`,
        `vat_number.ilike.${pattern}`,
      ].join(",")
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));

  return {
    clients: (data ?? []) as ClientRow[],
    total,
    page,
    pageSize: CLIENTS_PAGE_SIZE,
    totalPages,
  };
}

export async function getClientById(id: string): Promise<ClientDetail | null> {
  const { supabase } = await requireUser();

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!client) {
    return null;
  }

  const { data: documents, error: documentsError } = await supabase
    .from("client_documents")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select(
      "id, name, document_number, status, budget, currency, start_date, end_date"
    )
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (campaignsError) {
    throw new Error(campaignsError.message);
  }

  return {
    ...(client as ClientRow),
    documents: documents ?? [],
    campaigns: campaigns ?? [],
  };
}
