import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapFinancialMetricsToBillingKpis,
  rollupGlobal,
} from "@/lib/analytics";
import { buildBillingKpisFromOperationalRows } from "@/lib/analytics/billing-kpi-fallback";
import type { BillingKpiExtras } from "@/lib/analytics/queries/billing-bridge";
import { safeLoadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import type { BillingKpiSummary } from "@/features/billing/types";
import type { CampaignLineBillingStatus } from "@/lib/domains/campaign/types";
import { safeAnalyticsQuery } from "@/lib/platform/safe-query";
import { devLog } from "@/lib/platform/logger";

export type BillingKpiOperationalInput = {
  lines: {
    revenue: number;
    cost: number;
    gp: number;
    billing_status: CampaignLineBillingStatus;
  }[];
  invoices: { amount_paid: number; outstanding: number }[];
  unpaid_vendor_cost: number;
  extras: BillingKpiExtras;
};

/**
 * Optional analytics enrichment for billing KPI strip.
 * Always falls back to operational totals — never throws.
 */
export async function resolveBillingKpis(
  supabase: SupabaseClient,
  operational: BillingKpiOperationalInput
): Promise<{ kpis: BillingKpiSummary; analyticsAvailable: boolean }> {
  const fallback = buildBillingKpisFromOperationalRows(operational);

  const result = await safeAnalyticsQuery("billing-kpis", async () => {
    const snapshot = await safeLoadAnalyticsFacts(supabase);
    if (snapshot.facts.length === 0) {
      return fallback;
    }
    const globalMetrics = rollupGlobal(snapshot.facts).metrics;
    return mapFinancialMetricsToBillingKpis(globalMetrics, operational.extras);
  }, fallback);

  if (result.fallbackUsed && process.env.NODE_ENV === "development") {
    devLog("operational-isolation", "billing KPIs use operational-only path", {
      error: result.error,
    });
  }

  return {
    kpis: result.data,
    analyticsAvailable: result.ok && !result.fallbackUsed,
  };
}
