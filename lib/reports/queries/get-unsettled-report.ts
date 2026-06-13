import { parseClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import { buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { loadClientUnsettledLedger } from "@/lib/reports/queries/client-unsettled-ledger";
import {
  loadStatementGroupOptions,
  searchStatementClientsByGroup,
} from "@/lib/reports/queries/statement-options";
import type {
  UnsettledIndexData,
  UnsettledReportData,
  UnsettledReportQuery,
} from "@/lib/reports/statements/unsettled-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseUnsettledIndexSearchParams(
  params: Record<string, string | string[] | undefined>
): { search: string; groupId: string | null; clientType: ReturnType<typeof parseClientTypeFilter> } {
  const groupId = readParam(params, "groupId")?.trim() ?? "";
  return {
    search: readParam(params, "q")?.trim() ?? "",
    groupId: groupId || null,
    clientType: parseClientTypeFilter(readParam(params, "clientType")),
  };
}

export async function getUnsettledIndex(
  params: Record<string, string | string[] | undefined>
): Promise<UnsettledIndexData> {
  const { search, groupId, clientType } = parseUnsettledIndexSearchParams(params);
  const supabase = await createSupabaseServerClient();

  const [groups, clients] = await Promise.all([
    loadStatementGroupOptions(supabase),
    searchStatementClientsByGroup(supabase, {
      groupId: groupId ?? undefined,
      search: search || undefined,
      clientType,
    }),
  ]);

  return { search, groupId, clientType, groups, clients };
}

export function parseUnsettledReportSearchParams(
  params: Record<string, string | string[] | undefined>
): UnsettledReportQuery {
  const entityId = readParam(params, "entityId")?.trim() || null;
  return { entityId };
}

function emptyReport(
  query: UnsettledReportQuery,
  overrides: Partial<UnsettledReportData> = {}
): UnsettledReportData {
  return {
    entity_id: query.entityId,
    entity_name: null,
    entity_code: null,
    group_name: null,
    currency: "USD",
    currency_context: buildCurrencyContext(["USD"]),
    lines: [],
    totals: { total_debit: 0, total_credit: 0, closing_balance: 0 },
    ...overrides,
  };
}

export async function getUnsettledReport(
  query: UnsettledReportQuery
): Promise<UnsettledReportData> {
  const supabase = await createSupabaseServerClient();

  if (!query.entityId) {
    return emptyReport(query, { entity_id: null });
  }

  const ledger = await loadClientUnsettledLedger(supabase, query.entityId);

  if (!ledger) {
    return emptyReport(query);
  }

  const currencies = [...new Set(ledger.lines.map((line) => line.currency))];
  const currency = ledger.currency;
  const currency_context = buildCurrencyContext(
    currencies.length > 0 ? currencies : [currency]
  );

  return {
    entity_id: query.entityId,
    entity_name: ledger.entity_name,
    entity_code: ledger.entity_code,
    group_name: ledger.group_name,
    currency,
    currency_context,
    lines: ledger.lines,
    totals: ledger.totals,
  };
}
