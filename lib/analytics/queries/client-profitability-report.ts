import {
  buildClientProfitabilityReport,
  type ClientProfitabilityMeta,
} from "@/lib/analytics/client-profitability/build-client-profitability-report";
import {
  MAX_CLIENT_PROFITABILITY_SELECTION,
  type ClientProfitabilityReportData,
} from "@/lib/analytics/client-profitability/client-profitability-types";
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
import {
  clientTypeFilterLabel,
  filterFactsByClientType,
  loadClientAgencyOrDirectMap,
  matchesClientType,
  parseClientTypeFilter,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
import { resolveEffectiveExchangeRate } from "@/features/finance/exchange-rates/queries";
import { loadStatementClientOptions } from "@/lib/reports/queries/statement-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientProfitabilityReportQuery = {
  year?: number;
  period?: PnlPeriodScope;
  currency?: string;
  clientIds?: string[];
  clientType?: ClientTypeFilter;
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

function mapClientMeta(
  clients: Awaited<ReturnType<typeof loadStatementClientOptions>>
): ClientProfitabilityMeta[] {
  return clients.map((client) => ({
    client_id: client.id,
    client_name: client.name,
    client_code: client.code,
    group_name: client.group_name ?? null,
  }));
}

export async function getClientProfitabilityReport(
  query: ClientProfitabilityReportQuery = {}
): Promise<ClientProfitabilityReportData> {
  const supabase = await createSupabaseServerClient();
  const year = query.year ?? new Date().getFullYear();
  const periodScope = query.period ?? "fy";
  const clientType = query.clientType ?? "all";
  const selectedClientIds = (query.clientIds ?? []).slice(
    0,
    MAX_CLIENT_PROFITABILITY_SELECTION
  );

  const [rawFacts, clientOptions, agencyByClient] = await Promise.all([
    loadPnLLineFacts(supabase),
    loadStatementClientOptions(supabase),
    loadClientAgencyOrDirectMap(supabase),
  ]);

  const filteredFacts = filterFactsByClientType(rawFacts, agencyByClient, clientType);
  const filteredClients = clientOptions.filter((client) =>
    matchesClientType(agencyByClient.get(client.id) ?? null, clientType)
  );
  const availableCurrencies = buildPnlAvailableCurrencies(filteredFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const lineFacts = await convertPnlFactsToDisplayCurrency(
    filteredFacts,
    displayCurrency,
    (fromCurrency, toCurrency) =>
      resolveEffectiveExchangeRate({ from_currency: fromCurrency, to_currency: toCurrency })
  );

  const report = buildClientProfitabilityReport(
    lineFacts,
    mapClientMeta(filteredClients),
    year,
    periodScope,
    displayCurrency,
    availableCurrencies,
    selectedClientIds
  );
  return {
    ...report,
    client_type: clientType,
    client_type_label: clientTypeFilterLabel(clientType),
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSelectedClientIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => UUID_PATTERN.test(value))
    .slice(0, MAX_CLIENT_PROFITABILITY_SELECTION);
}

export function parseClientProfitabilitySearchParams(
  params: Record<string, string | string[] | undefined>
): ClientProfitabilityReportQuery {
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const currentYear = new Date().getFullYear();
  const year = parsePnlYear(read("year"), currentYear);
  const currencyRaw = read("currency");
  const clientsRaw = read("clients");

  return {
    year,
    period: parsePnlPeriodScope(read("period")),
    currency: currencyRaw?.trim().toUpperCase(),
    clientIds: parseSelectedClientIds(clientsRaw),
    clientType: parseClientTypeFilter(read("clientType")),
  };
}