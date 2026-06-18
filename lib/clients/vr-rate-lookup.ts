import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import {
  getMissingClientColumnFromSchemaError,
  isMissingClientColumnSchemaError,
} from "@/lib/clients/classification-audit-columns";

export type VrRateLookupRow = {
  id: string;
  rate_percent: number;
  name?: string;
};

export const CLIENT_GROUP_LIST_SELECT_CORE =
  "id, document_number, name, legal_name, country, currency, payment_terms, agency_or_direct, status";

export const CLIENT_GROUP_LIST_SELECT_WITH_VR = `${CLIENT_GROUP_LIST_SELECT_CORE}, vr_rate_id`;

export type GroupClientListRow = {
  id: string;
  document_number: string;
  name: string;
  legal_name: string | null;
  country: string | null;
  currency: string;
  payment_terms: string | null;
  agency_or_direct: string | null;
  status: string;
};

export const CLIENT_FORM_SELECT_CORE =
  "id, name, legal_name, group_id, document_number, status";

export const CLIENT_FORM_SELECT_WITH_VR = `${CLIENT_FORM_SELECT_CORE}, vr_rate_id`;

export async function fetchVrRatesByIds(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, VrRateLookupRow>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("md_vr_rates")
    .select("id, name, rate_percent")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [row.id, row]));
}

export function vrRatePercentFromMap(
  map: Map<string, Pick<VrRateLookupRow, "rate_percent">>,
  vrRateId: string | null | undefined
): number | null {
  if (!vrRateId) {
    return null;
  }
  return map.get(vrRateId)?.rate_percent ?? null;
}

function isMissingClientVrRateColumnError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  return (
    isMissingClientColumnSchemaError(error) &&
    getMissingClientColumnFromSchemaError(error) === "vr_rate_id"
  );
}

/** Safe read of clients.vr_rate_id when the column may not exist on production yet. */
export async function fetchClientVrRateIdSafe(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ value: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("clients")
    .select("vr_rate_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!error) {
    return { value: data?.vr_rate_id ?? null, error: null };
  }

  if (isMissingClientVrRateColumnError(error)) {
    return { value: null, error: null };
  }

  return { value: null, error: error.message };
}

type ClientRowWithOptionalVr<T> = T & { vr_rate_id: string | null };

type ClientQueryResult = {
  data: Record<string, unknown>[] | null;
  error: PostgrestError | null;
};

async function queryClientsWithOptionalVrRateColumn<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  selectWithVr: string,
  selectCore: string,
  runQuery: (select: string) => PromiseLike<ClientQueryResult>
): Promise<{ data: ClientRowWithOptionalVr<T>[] | null; error: PostgrestError | null }> {
  const withVr = await runQuery(selectWithVr);

  if (!withVr.error) {
    return {
      data: (withVr.data ?? []).map((row) => ({
        ...(row as T),
        vr_rate_id: (row as T & { vr_rate_id?: string | null }).vr_rate_id ?? null,
      })),
      error: null,
    };
  }

  if (!isMissingClientVrRateColumnError(withVr.error)) {
    return { data: null, error: withVr.error };
  }

  const fallback = await runQuery(selectCore);
  if (fallback.error) {
    return { data: null, error: fallback.error };
  }

  return {
    data: (fallback.data ?? []).map((row) => ({
      ...(row as T),
      vr_rate_id: null,
    })),
    error: null,
  };
}

export async function fetchGroupClientsWithOptionalVrRate(
  supabase: SupabaseClient,
  groupId: string
): Promise<{
  data: ClientRowWithOptionalVr<GroupClientListRow>[] | null;
  error: PostgrestError | null;
}> {
  const result = await queryClientsWithOptionalVrRateColumn(
    supabase,
    CLIENT_GROUP_LIST_SELECT_WITH_VR,
    CLIENT_GROUP_LIST_SELECT_CORE,
    (select) =>
      supabase
        .from("clients")
        .select(select)
        .eq("group_id", groupId)
        .order("name") as unknown as PromiseLike<ClientQueryResult>,
  );

  return result as {
    data: ClientRowWithOptionalVr<GroupClientListRow>[] | null;
    error: PostgrestError | null;
  };
}

export async function fetchClientsForSelectWithOptionalVrRate(
  supabase: SupabaseClient,
  groupId?: string
): Promise<{
  data: ClientRowWithOptionalVr<Record<string, unknown>>[] | null;
  error: PostgrestError | null;
}> {
  return queryClientsWithOptionalVrRateColumn(
    supabase,
    CLIENT_FORM_SELECT_WITH_VR,
    CLIENT_FORM_SELECT_CORE,
    (select) => {
      let query = supabase
        .from("clients")
        .select(select)
        .neq("status", "archived")
        .order("name");

      if (groupId) {
        query = query.eq("group_id", groupId);
      }

      return query as unknown as PromiseLike<ClientQueryResult>;
    }
  );
}
