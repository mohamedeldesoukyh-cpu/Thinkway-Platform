import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/types/database";

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

export async function getClientsList(params: {
  page?: number;
  search?: string;
}): Promise<ClientsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * CLIENTS_PAGE_SIZE;
  const to = from + CLIENTS_PAGE_SIZE - 1;

  const supabase = await createSupabaseServerClient();

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
    clients: data ?? [],
    total,
    page,
    pageSize: CLIENTS_PAGE_SIZE,
    totalPages,
  };
}
