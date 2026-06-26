import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import { applyGroupIdColumnFilter } from "@/lib/groups/group-filter";
import type {
  StatementEntityOption,
  StatementGroupOption,
} from "@/lib/reports/statements/statement-types";

const STATEMENT_OPTIONS_LIMIT = 500;

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

type ClientRow = {
  id: string;
  name: string;
  document_number: string | null;
  group?: { name: string } | { name: string }[] | null;
};

function readGroupName(
  group: ClientRow["group"]
): string | null {
  if (!group) return null;
  if (Array.isArray(group)) return group[0]?.name ?? null;
  return group.name ?? null;
}

function mapClientRow(row: ClientRow): StatementEntityOption {
  return {
    id: row.id,
    name: row.name,
    code: row.document_number,
    group_name: readGroupName(row.group),
  };
}

function mapVendorRow(row: {
  id: string;
  display_name: string | null;
  legal_name: string | null;
  document_number: string | null;
}): StatementEntityOption {
  return {
    id: row.id,
    name: row.display_name?.trim() || row.legal_name?.trim() || "Vendor",
    code: row.document_number,
  };
}

export async function loadStatementGroupOptions(
  supabase: SupabaseClient
): Promise<StatementGroupOption[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, document_number")
    .eq("status", "active")
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.document_number,
  }));
}

export async function searchStatementClientsByGroup(
  supabase: SupabaseClient,
  options: { groupId?: string; search?: string; clientType?: ClientTypeFilter } = {}
): Promise<StatementEntityOption[]> {
  const search = options.search?.trim() ?? "";
  const hasSearch = search.length > 0;
  const clientType = options.clientType ?? "all";

  let query = supabase
    .from("clients")
    .select("id, name, document_number, group:groups(name)")
    .order("name");

  if (options.groupId) {
    query = applyGroupIdColumnFilter(query as never, options.groupId) as typeof query;
  }

  if (clientType === "agency") {
    query = query.eq("agency_or_direct", "agency");
  } else if (clientType === "direct") {
    query = query.eq("agency_or_direct", "direct");
  }

  if (hasSearch) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(`name.ilike.${pattern},document_number.ilike.${pattern}`);
  }

  query = query.limit(hasSearch ? 30 : STATEMENT_OPTIONS_LIMIT);

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapClientRow(row as ClientRow));
}

export async function searchStatementClientOptions(
  supabase: SupabaseClient,
  search: string
): Promise<StatementEntityOption[]> {
  return searchStatementClientsByGroup(supabase, { search });
}

export async function searchStatementVendorOptions(
  supabase: SupabaseClient,
  search: string
): Promise<StatementEntityOption[]> {
  const query = search.trim();
  if (!query) return [];

  const pattern = `%${escapeIlikePattern(query)}%`;
  const { data, error } = await supabase
    .from("influencers")
    .select("id, display_name, legal_name, document_number")
    .neq("status", "archived")
    .or(
      `display_name.ilike.${pattern},legal_name.ilike.${pattern},document_number.ilike.${pattern}`
    )
    .order("display_name")
    .limit(30);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    mapVendorRow(
      row as {
        id: string;
        display_name: string | null;
        legal_name: string | null;
        document_number: string | null;
      }
    )
  );
}

export async function loadStatementClientOptions(
  supabase: SupabaseClient
): Promise<StatementEntityOption[]> {
  return searchStatementClientsByGroup(supabase);
}

export async function loadStatementVendorOptions(
  supabase: SupabaseClient
): Promise<StatementEntityOption[]> {
  const { data, error } = await supabase
    .from("influencers")
    .select("id, display_name, legal_name, document_number")
    .neq("status", "archived")
    .order("display_name")
    .limit(STATEMENT_OPTIONS_LIMIT);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    mapVendorRow(
      row as {
        id: string;
        display_name: string | null;
        legal_name: string | null;
        document_number: string | null;
      }
    )
  );
}
