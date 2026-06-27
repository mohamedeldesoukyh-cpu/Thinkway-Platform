import { buildVrReport } from "@/lib/analytics/vr-report/build-vr-report";
import type { VrReportData } from "@/lib/analytics/vr-report/vr-report-types";
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
  parseClientTypeFilter,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
import { resolveEffectiveExchangeRate } from "@/lib/finance/exchange-rates/resolve-rate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type VrReportQuery = {
  year?: number;
  period?: PnlPeriodScope;
  currency?: string;
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

export async function getVrReport(query: VrReportQuery = {}): Promise<VrReportData> {
  const supabase = await createSupabaseServerClient();
  const year = query.year ?? new Date().getFullYear();
  const periodScope = query.period ?? "fy";
  const clientType = query.clientType ?? "all";

  const [rawFacts, agencyByClient] = await Promise.all([
    loadPnLLineFacts(supabase),
    loadClientAgencyOrDirectMap(supabase),
  ]);
  const filteredFacts = filterFactsByClientType(rawFacts, agencyByClient, clientType);
  const availableCurrencies = buildPnlAvailableCurrencies(filteredFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const lineFacts = await convertPnlFactsToDisplayCurrency(
    filteredFacts,
    displayCurrency,
    (fromCurrency, toCurrency) =>
      resolveEffectiveExchangeRate({ from_currency: fromCurrency, to_currency: toCurrency })
  );

  const report = buildVrReport(
    lineFacts,
    year,
    periodScope,
    displayCurrency,
    availableCurrencies
  );
  return {
    ...report,
    client_type: clientType,
    client_type_label: clientTypeFilterLabel(clientType),
  };
}

export function parseVrReportSearchParams(
  params: Record<string, string | string[] | undefined>
): VrReportQuery {
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
    clientType: parseClientTypeFilter(read("clientType")),
  };
}
