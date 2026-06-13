import { buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { loadClientStatementLedger } from "@/lib/reports/queries/client-statement-ledger";
import { loadVendorStatementLedger } from "@/lib/reports/queries/vendor-statement-ledger";
import type {
  StatementType,
  StatementsReportData,
  StatementsReportQuery,
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

function parseDateParam(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function parseStatementsReportSearchParams(
  params: Record<string, string | string[] | undefined>
): StatementsReportQuery {
  const entityId = readParam(params, "entityId")?.trim() || null;

  return {
    type: parseStatementType(readParam(params, "type")),
    entityId,
    fromDate: parseDateParam(readParam(params, "from")),
    toDate: parseDateParam(readParam(params, "to")),
  };
}

function emptyReport(
  query: StatementsReportQuery,
  overrides: Partial<StatementsReportData> = {}
): StatementsReportData {
  return {
    type: query.type,
    entity_id: query.entityId,
    entity_name: null,
    entity_code: null,
    group_name: null,
    from_date: query.fromDate,
    to_date: query.toDate,
    currency: "USD",
    currency_context: buildCurrencyContext(["USD"]),
    lines: [],
    totals: { total_debit: 0, total_credit: 0, closing_balance: 0 },
    clients: [],
    vendors: [],
    ...overrides,
  };
}

export async function getStatementsReport(
  query: StatementsReportQuery
): Promise<StatementsReportData> {
  const supabase = await createSupabaseServerClient();

  if (!query.entityId) {
    return emptyReport(query, { entity_id: null });
  }

  if (query.type === "vendor") {
    const ledger = await loadVendorStatementLedger(supabase, query.entityId, {
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    if (!ledger) {
      return emptyReport(query);
    }

    const currencies = [...new Set(ledger.lines.map((line) => line.currency))];
    const currency = ledger.currency;
    const currency_context = buildCurrencyContext(
      currencies.length > 0 ? currencies : [currency]
    );

    return {
      type: query.type,
      entity_id: query.entityId,
      entity_name: ledger.entity_name,
      entity_code: ledger.entity_code,
      group_name: null,
      from_date: query.fromDate,
      to_date: query.toDate,
      currency,
      currency_context,
      lines: ledger.lines,
      totals: ledger.totals,
      clients: [],
      vendors: [],
    };
  }

  const ledger = await loadClientStatementLedger(supabase, query.entityId, {
    fromDate: query.fromDate,
    toDate: query.toDate,
  });

  if (!ledger) {
    return emptyReport(query);
  }

  const currencies = [...new Set(ledger.lines.map((line) => line.currency))];
  const currency = ledger.currency;
  const currency_context = buildCurrencyContext(
    currencies.length > 0 ? currencies : [currency]
  );

  return {
    type: query.type,
    entity_id: query.entityId,
    entity_name: ledger.entity_name,
    entity_code: ledger.entity_code,
    group_name: ledger.group_name,
    from_date: query.fromDate,
    to_date: query.toDate,
    currency,
    currency_context,
    lines: ledger.lines,
    totals: ledger.totals,
    clients: [],
    vendors: [],
  };
}
