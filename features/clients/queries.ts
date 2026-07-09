import { getBrandsByClientId } from "@/features/brands/queries";
import { fetchClientDetailRowById } from "@/lib/clients/client-detail-query";
import { isMissingClientDocumentsRelation, serializeClientDocumentRows } from "@/lib/clients/client-document-utils";
import {
  getMissingClientColumnFromSchemaError,
  isMissingClientColumnSchemaError,
  NAME_AR_COLUMN,
} from "@/lib/clients/classification-audit-columns";
import {
  fetchVrRatesByIds,
  vrRatePercentFromMap,
} from "@/lib/clients/vr-rate-lookup";
import { requireRequestUser, type RequestUser } from "@/lib/supabase/server";
import type { ClientDetail, ClientDocumentRow, ClientRow } from "@/types/database";

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


async function fetchClientDocumentsSafe(
  supabase: RequestUser["supabase"],
  clientId: string
): Promise<ClientDocumentRow[]> {
  const { data, error } = await supabase
    .from("client_documents")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (!error) {
    return serializeClientDocumentRows((data ?? []) as Record<string, unknown>[]);
  }

  if (isMissingClientDocumentsRelation(error.message)) {
    console.warn(
      `[clients] client_documents unavailable while loading client ${clientId}:`,
      error.message
    );
    return [];
  }

  throw new Error(error.message);
}

async function fetchClientBrandsSafe(clientId: string): Promise<ClientDetail["brands"]> {
  try {
    return await getBrandsByClientId(clientId);
  } catch (error) {
    console.warn(
      `[clients] brands query failed while loading client ${clientId}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

async function fetchClientCampaignsSafe(
  supabase: RequestUser["supabase"],
  clientId: string
): Promise<ClientDetail["campaigns"]> {
  const { data, error } = await supabase
    .from("campaign_headers")
    .select(
      "id, name, document_number, status, currency_code, start_date, end_date, brand:brands(id, name)"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (!error) {
    return (data ?? []) as unknown as ClientDetail["campaigns"];
  }

  console.warn(
    `[clients] campaigns query failed while loading client ${clientId}:`,
    error.message
  );
  return [];
}

async function fetchClientVrRateMapSafe(
  supabase: RequestUser["supabase"],
  vrRateId: string | null | undefined
) {
  try {
    return await fetchVrRatesByIds(supabase, [vrRateId]);
  } catch (error) {
    console.warn(
      "[clients] VR rate lookup failed while loading client:",
      error instanceof Error ? error.message : error
    );
    return new Map();
  }
}

export async function getClientsList(params: {
  page?: number;
  search?: string;
}): Promise<ClientsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * CLIENTS_PAGE_SIZE;
  const to = from + CLIENTS_PAGE_SIZE - 1;

  const { supabase } = await requireRequestUser();

  const searchFiltersWithNameAr = (pattern: string) =>
    [
      `name.ilike.${pattern}`,
      `name_ar.ilike.${pattern}`,
      `legal_name.ilike.${pattern}`,
      `document_number.ilike.${pattern}`,
    ].join(",");

  const searchFiltersCore = (pattern: string) =>
    [
      `name.ilike.${pattern}`,
      `legal_name.ilike.${pattern}`,
      `document_number.ilike.${pattern}`,
    ].join(",");

  async function runListQuery(includeNameArFilter: boolean) {
    let query = supabase
      .from("clients")
      .select("*, group:groups(id, name)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      const pattern = `%${escapeIlikePattern(search)}%`;
      query = query.or(
        includeNameArFilter
          ? searchFiltersWithNameAr(pattern)
          : searchFiltersCore(pattern)
      );
    }

    return query.range(from, to);
  }

  let { data, error, count } = await runListQuery(true);

  if (
    error &&
    search &&
    isMissingClientColumnSchemaError(error) &&
    getMissingClientColumnFromSchemaError(error) === NAME_AR_COLUMN
  ) {
    console.warn(
      "[clients] name_ar column missing while searching clients; retrying without Arabic name filter:",
      error.message
    );
    ({ data, error, count } = await runListQuery(false));
  }

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
  const { supabase } = await requireRequestUser();

  const { client: clientRow, error: clientError } = await fetchClientDetailRowById(
    supabase,
    id
  );

  if (clientError) {
    throw new Error(clientError.message);
  }

  if (!clientRow) {
    return null;
  }

  const [documents, campaigns, brands, vrRateMap] = await Promise.all([
    fetchClientDocumentsSafe(supabase, id),
    fetchClientCampaignsSafe(supabase, id),
    fetchClientBrandsSafe(id),
    fetchClientVrRateMapSafe(supabase, clientRow.vr_rate_id),
  ]);

  return {
    ...clientRow,
    group: clientRow.group,
    vr_rate_percent: vrRatePercentFromMap(vrRateMap, clientRow.vr_rate_id),
    documents,
    campaigns,
    brands,
  };
}
