import type { CampaignLineBillingStatus } from "@/lib/domains/campaign/types";

/** Hierarchy level for dashboard rollups. */
export type AnalyticsRollupLevel =
  | "campaign"
  | "client"
  | "brand"
  | "country"
  | "team"
  | "global";

export type AnalyticsDateRange = {
  from?: string;
  to?: string;
};

export type AnalyticsBillingFilter =
  | "all"
  | "not_invoiced"
  | "partially_invoiced"
  | "invoiced"
  | "in_collections"
  | "collected";

export type AnalyticsOperationalFilter =
  | "all"
  | "draft"
  | "approved"
  | "moved_to_billing"
  | "achieved"
  | "unachieved";

export type AnalyticsInvoiceFilter =
  | "all"
  | "open"
  | "partial"
  | "paid"
  | "overdue";

export type AnalyticsQueryFilters = {
  dateRange?: AnalyticsDateRange;
  billingStatus?: CampaignLineBillingStatus[];
  billingFilter?: AnalyticsBillingFilter;
  operationalFilter?: AnalyticsOperationalFilter;
  invoiceFilter?: AnalyticsInvoiceFilter;
  clientIds?: string[];
  brandIds?: string[];
  countryCodes?: string[];
  teamIds?: string[];
  campaignHeaderIds?: string[];
  currencyCode?: string;
};

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsQueryFilters = {
  billingFilter: "all",
  operationalFilter: "all",
  invoiceFilter: "all",
};
