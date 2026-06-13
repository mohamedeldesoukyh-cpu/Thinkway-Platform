import {
  loadStatementGroupOptions,
  loadStatementVendorOptions,
  searchStatementClientsByGroup,
  searchStatementVendorOptions,
} from "@/lib/reports/queries/statement-options";
import { parseClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import type {
  StatementType,
  StatementsIndexData,
} from "@/lib/reports/statements/statement-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseStatementType(raw: string | undefined): StatementType {
  return raw === "vendor" ? "vendor" : "client";
}

export function parseStatementsIndexSearchParams(
  params: Record<string, string | string[] | undefined>
): { type: StatementType; search: string; groupId: string | null; clientType: ReturnType<typeof parseClientTypeFilter> } {
  const groupId = readParam(params, "groupId")?.trim() ?? "";
  return {
    type: parseStatementType(readParam(params, "type")),
    search: readParam(params, "q")?.trim() ?? "",
    groupId: groupId || null,
    clientType: parseClientTypeFilter(readParam(params, "clientType")),
  };
}

export async function getStatementsIndex(
  params: Record<string, string | string[] | undefined>
): Promise<StatementsIndexData> {
  const { type, search, groupId, clientType } = parseStatementsIndexSearchParams(params);
  const supabase = await createSupabaseServerClient();

  if (type === "vendor") {
    const vendors = search
      ? await searchStatementVendorOptions(supabase, search)
      : await loadStatementVendorOptions(supabase);
    return { type, search, groupId: null, clientType: "all", groups: [], clients: [], vendors };
  }

  const [groups, clients] = await Promise.all([
    loadStatementGroupOptions(supabase),
    searchStatementClientsByGroup(supabase, {
      groupId: groupId ?? undefined,
      search: search || undefined,
      clientType,
    }),
  ]);

  return { type, search, groupId, clientType, groups, clients, vendors: [] };
}
