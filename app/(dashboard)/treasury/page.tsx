export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { TreasuryDashboardView } from "@/features/treasury/components/treasury-dashboard-view";
import { loadTreasuryDashboard } from "@/lib/treasury/load-treasury-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeAnalyticsQuery } from "@/lib/platform/safe-query";

const EMPTY_TREASURY = {
  kpis: [],
  cashflow: {
    weekly: [],
    monthly: [],
    expected_collections: 0,
    expected_payouts: 0,
    net_cashflow: 0,
  },
  charts: {
    cashflow_trend: [],
    collections_trend: [],
    payout_trend: [],
    liquidity_forecast: [],
  },
  currency: {
    primary_currency: "USD",
    currencies: [],
    is_mixed_currency: false,
    mixed_label: null,
  },
};

export default async function TreasuryPage() {
  const result = await safeAnalyticsQuery("treasury-page", async () => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Unauthorized");
    return loadTreasuryDashboard(supabase);
  }, EMPTY_TREASURY);

  return (
    <FinanceSuiteShell
      title="Treasury"
      description="Cashflow position and liquidity forecasting"
    >
      <Suspense
        fallback={
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        }
      >
        <PlatformErrorBoundary surface="treasury">
          <TreasuryDashboardView data={result.data} />
        </PlatformErrorBoundary>
      </Suspense>
    </FinanceSuiteShell>
  );
}
