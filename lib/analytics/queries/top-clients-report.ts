import { parseClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import { buildTopClientsReport } from "@/lib/analytics/top-clients/build-top-clients-report";
import type { TopClientsClientMeta } from "@/lib/analytics/top-clients/build-top-clients-report";
import type {
  TopClientsClientTypeFilter,
  TopClientsMetric,
  TopClientsReportData,
} from "@/lib/analytics/top-clients/top-clients-types";
import {
  TOP_CLIENTS_DEFAULT_LIMIT,
  TOP_CLIENTS_MAX_LIMIT,
  TOP_CLIENTS_MIN_LIMIT,
} from "@/lib/analytics/top-clients/top-clients-types";
import {
  convertPnlFactsToDisplayCurrency,
  normalizePnlDisplayCurrency,
  PNL_FALLBACK_DISPLAY_CURRENCIES,
} from "@/lib/analytics/pnl/pnl-currency";
import type { PnlLineFact } from "@/lib/analytics/pnl/pnl-report-types";
import {
  parsePnlPeriodScope,
  parsePnlYear,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import { loadPnLLineFacts } from "@/lib/analytics/queries/pnl-report";
import { resolveEffectiveExchangeRate } from "@/features/finance/exchange-rates/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgencyOrDirect } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TopClientsReportQuery = {
  year?: number;
  period?: PnlPeriodScope;
  currency?: string;
  metric?: TopClientsMetric;
  limit?: number;
  clientType?: TopClientsClientTypeFilter;
};

function buildPnlAvailableCurrencies(facts: PnlLineFact[]): string[] {
  const fromFacts = [
    ...new Set(
      facts
        .map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())
        .filter((code) => code.length === 3)
    ),
  ];
  return [...new Set([...PNL_FALLBACK_DISPLAY_CURRENCIES, ...fromFacts])].sort();
}

async function loadTopClientsClientMeta(
  supabase: SupabaseClient
): Promise<TopClientsClientMeta[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, agency_or_direct")
    .neq("status", "archived")
    .order("name")
    .limit(5000);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    client_id: row.id,
    client_name: row.name,
    agency_or_direct: (row.agency_or_direct as AgencyOrDirect | null) ?? null,
  }));
}

export async function getTopClientsReport(
  query: TopClientsReportQuery = {}
): Promise<TopClientsReportData> {
  const supabase = await createSupabaseServerClient();
  const year = query.year ?? new Date().getFullYear();
  const periodScope = query.period ?? "fy";
  const metric = query.metric ?? "revenue";
  const limit = query.limit ?? TOP_CLIENTS_DEFAULT_LIMIT;
  const clientType = query.clientType ?? "all";

  const [rawFacts, clients] = await Promise.all([
    loadPnLLineFacts(supabase),
    loadTopClientsClientMeta(supabase),
  ]);

  const availableCurrencies = buildPnlAvailableCurrencies(rawFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const lineFacts = await convertPnlFactsToDisplayCurrency(
    rawFacts,
    displayCurrency,
    (fromCurrency, toCurrency) =>
      resolveEffectiveExchangeRate({ from_currency: fromCurrency, to_currency: toCurrency })
  );

  return buildTopClientsReport(
    lineFacts,
    clients,
    year,
    periodScope,
    displayCurrency,
    availableCurrencies,
    metric,
    limit,
    clientType
  );
}

function parseTopClientsMetric(value: string | undefined): TopClientsMetric {
  return value === "gp" ? "gp" : "revenue";
}

function parseTopClientsLimit(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return TOP_CLIENTS_DEFAULT_LIMIT;
  return Math.min(
    TOP_CLIENTS_MAX_LIMIT,
    Math.max(TOP_CLIENTS_MIN_LIMIT, Math.round(parsed))
  );
}

export function parseTopClientsSearchParams(
  params: Record<string, string | string[] | undefined>
): TopClientsReportQuery {
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const currentYear = new Date().getFullYear();
  const year = parsePnlYear(read("year"), currentYear);
  const currencyRaw = read("currency");

  return {
    year,
    period: parsePnlPeriodScope(read("period")),
    currency: currencyRaw?.trim().toUpperCase(),
    metric: parseTopClientsMetric(read("metric")),
    limit: parseTopClientsLimit(read("limit")),
    clientType: parseClientTypeFilter(read("clientType")),
  };
}
