import { formatAnalyticsAmount, buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { devLog } from "@/lib/dev-log";
import type { AnalyticsKpiCard, AnalyticsKpiStrip } from "@/lib/analytics/types/outputs";
import type { FinancialMetrics } from "@/lib/analytics/types/metrics";

export function buildKpiStripFromMetrics(
  metrics: FinancialMetrics,
  currencyCodes: string[],
  cards: Array<{
    id: string;
    label: string;
    pick: (m: FinancialMetrics) => number;
    alert?: AnalyticsKpiCard["alert"];
    decimals?: number;
  }>
): AnalyticsKpiStrip {
  const currency = buildCurrencyContext(currencyCodes);

  const kpiCards: AnalyticsKpiCard[] = cards.map((card) => {
    const value = card.pick(metrics);
    return {
      id: card.id,
      label: card.label,
      value,
      formatted_value: formatAnalyticsAmount(value, currency, {
        decimals: card.decimals ?? 0,
      }),
      currency,
      alert: card.alert,
    };
  });

  if (process.env.NODE_ENV === "development") {
    devLog("[kpi-engine] built KPI strip", {
      cardCount: kpiCards.length,
      mixed: currency.is_mixed_currency,
    });
  }

  return {
    cards: kpiCards,
    currency,
    generated_at: new Date().toISOString(),
  };
}
