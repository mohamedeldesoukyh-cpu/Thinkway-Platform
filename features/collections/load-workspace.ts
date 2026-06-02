import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadDashboardFilterOptions } from "@/features/analytics/load-executive-dashboard";
import type { DashboardFilterOptions } from "@/features/analytics/load-executive-dashboard";
import {
  collectionsFiltersToAnalytics,
  type CollectionsFilterState,
} from "@/lib/collections/dashboard-filters";
import { loadCollectionsDashboard, type CollectionsDashboardPayload } from "@/lib/collections/queries/load-collections-dashboard";
import { loadClientStatement, type ClientStatementPayload } from "@/lib/collections/queries/client-statements";
import { loadTreasuryDashboard, type TreasuryDashboardPayload } from "@/lib/treasury/load-treasury-dashboard";
import { loadVendorPayables, type VendorPayablesPayload } from "@/lib/vendor-payables/load-payables";
import { devLog } from "@/lib/platform/logger";
import {
  safeAnalyticsQuery,
  safeOperationalQuery,
} from "@/lib/platform/safe-query";

const EMPTY_DASHBOARD: CollectionsDashboardPayload = {
  kpis: [],
  aging: {
    buckets: [],
    total_outstanding: 0,
    overdue_amount: 0,
    current_amount: 0,
    invoice_count: 0,
  },
  aged_invoices: [],
  client_aging: [],
  analytics_aging: [],
  alerts: { alerts: [] },
  currency: {
    primary_currency: "USD",
    currencies: [],
    is_mixed_currency: false,
    mixed_label: null,
  },
  collections_this_month: 0,
  partial_count: 0,
  disputed_count: 0,
};

export type CollectionsWorkspacePayload = {
  filterState: CollectionsFilterState;
  dashboard: CollectionsDashboardPayload;
  treasury: TreasuryDashboardPayload | null;
  payables: VendorPayablesPayload | null;
  statement: ClientStatementPayload | null;
  filterOptions: DashboardFilterOptions;
  queryWarnings: string[];
};

async function requireSupabase() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return supabase;
}

export async function loadCollectionsWorkspace(
  filterState: CollectionsFilterState
): Promise<CollectionsWorkspacePayload> {
  const supabase = await requireSupabase();
  const analyticsFilters = collectionsFiltersToAnalytics(filterState);
  const queryWarnings: string[] = [];

  const [dashboardResult, treasuryResult, payablesResult, filterOptions] =
    await Promise.all([
      safeAnalyticsQuery(
        "collections-dashboard",
        () => loadCollectionsDashboard(supabase, analyticsFilters),
        EMPTY_DASHBOARD
      ),
      safeAnalyticsQuery(
        "treasury-embed",
        () => loadTreasuryDashboard(supabase),
        null
      ),
      safeOperationalQuery(
        "vendor-payables",
        () => loadVendorPayables(supabase),
        null
      ),
      loadDashboardFilterOptions().catch(() => ({
        clients: [],
        brands: [],
        countries: [],
        currencies: ["USD"],
      })),
    ]);

  if (!dashboardResult.ok) {
    queryWarnings.push(dashboardResult.error ?? "Collections dashboard unavailable");
  }
  if (!treasuryResult.ok) {
    queryWarnings.push(treasuryResult.error ?? "Treasury data unavailable");
  }
  if (!payablesResult.ok) {
    queryWarnings.push(payablesResult.error ?? "Payables unavailable");
  }

  let statement: ClientStatementPayload | null = null;
  if (filterState.clientId) {
    const statementResult = await safeOperationalQuery(
      "client-statement",
      () => loadClientStatement(supabase, filterState.clientId!),
      null
    );
    statement = statementResult.data;
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[collections] workspace loaded", {
      tab: filterState.tab,
      warnings: queryWarnings.length,
    });
  }

  return {
    filterState,
    dashboard: dashboardResult.data,
    treasury: treasuryResult.data,
    payables: payablesResult.data,
    statement,
    filterOptions,
    queryWarnings,
  };
}
