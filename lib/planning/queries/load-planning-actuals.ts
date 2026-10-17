import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import { safeLoadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { withAnalyticsCache, analyticsRequestKey } from "@/lib/analytics/aggregations/memo";

export async function loadPlanningActuals(supabase: SupabaseClient, versionId: string, filters: AnalyticsQueryFilters) {
  return withAnalyticsCache("planning-actuals:" + analyticsRequestKey(supabase, { versionId, filters }), async () => {
    const { data: version, error } = await supabase.from("budget_versions").select("fiscal_year, currency_code").eq("id", versionId).single();
    if (error || !version) throw new Error(error?.message ?? "Budget unavailable.");
    const currency = String(version.currency_code).trim();
    const scopedFilters = { ...filters, dateRange: { from: `${version.fiscal_year}-01-01`, to: `${version.fiscal_year}-12-31` } };
    const [snapshot, rate] = await Promise.all([safeLoadAnalyticsFacts(supabase, scopedFilters), resolveRateToEgp(supabase, currency)]);
    const facts = snapshot.facts.map(fact => ({ ...fact, currency_code: currency,
      metrics: { ...fact.metrics, revenue: roundMoney(fact.metrics.revenue / rate), cost: roundMoney(fact.metrics.cost / rate),
        gp: roundMoney(fact.metrics.gp / rate), collected_revenue: roundMoney(fact.metrics.collected_revenue / rate),
        vendor_payable: roundMoney(fact.metrics.vendor_payable / rate), actual_amount: roundMoney(fact.metrics.actual_amount / rate) } }));
    return { ...snapshot, facts, rate, year: Number(version.fiscal_year), currency };
  });
}
