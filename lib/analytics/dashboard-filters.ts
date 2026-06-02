import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import { DEFAULT_ANALYTICS_FILTERS } from "@/lib/analytics/types/filters";

export type DashboardFilterState = {
  from?: string;
  to?: string;
  country?: string;
  clientId?: string;
  brandId?: string;
  currency?: string;
  campaignStatus?: string;
};

export function parseDashboardSearchParams(
  params: Record<string, string | string[] | undefined>
): DashboardFilterState {
  const pick = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };

  return {
    from: pick("from"),
    to: pick("to"),
    country: pick("country"),
    clientId: pick("client"),
    brandId: pick("brand"),
    currency: pick("currency"),
    campaignStatus: pick("status"),
  };
}

export function dashboardFiltersToAnalytics(
  state: DashboardFilterState
): AnalyticsQueryFilters {
  const filters: AnalyticsQueryFilters = {
    ...DEFAULT_ANALYTICS_FILTERS,
    dateRange:
      state.from || state.to
        ? { from: state.from, to: state.to }
        : undefined,
    countryCodes: state.country ? [state.country] : undefined,
    clientIds: state.clientId ? [state.clientId] : undefined,
    brandIds: state.brandId ? [state.brandId] : undefined,
    currencyCode: state.currency,
  };

  if (state.campaignStatus === "achieved") {
    filters.operationalFilter = "achieved";
  } else if (state.campaignStatus === "unachieved") {
    filters.operationalFilter = "unachieved";
  } else if (state.campaignStatus === "in_collections") {
    filters.billingFilter = "in_collections";
  } else if (state.campaignStatus === "invoiced") {
    filters.billingFilter = "invoiced";
  }

  return filters;
}

export function serializeDashboardFilters(
  state: DashboardFilterState
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.country) params.set("country", state.country);
  if (state.clientId) params.set("client", state.clientId);
  if (state.brandId) params.set("brand", state.brandId);
  if (state.currency) params.set("currency", state.currency);
  if (state.campaignStatus) params.set("status", state.campaignStatus);
  return params;
}
