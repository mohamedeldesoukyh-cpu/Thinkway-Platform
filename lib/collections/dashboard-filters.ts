import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import { DEFAULT_ANALYTICS_FILTERS } from "@/lib/analytics/types/filters";

export type CollectionsFilterState = {
  tab?: string;
  clientId?: string;
  country?: string;
};

export function parseCollectionsSearchParams(
  params: Record<string, string | string[] | undefined>
): CollectionsFilterState {
  const pick = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };
  return {
    tab: pick("tab"),
    clientId: pick("client"),
    country: pick("country"),
  };
}

export function collectionsFiltersToAnalytics(
  state: CollectionsFilterState
): AnalyticsQueryFilters {
  const filters: AnalyticsQueryFilters = { ...DEFAULT_ANALYTICS_FILTERS };
  if (state.clientId) filters.clientIds = [state.clientId];
  if (state.country) filters.countryCodes = [state.country];
  return filters;
}

export function serializeCollectionsFilters(
  state: CollectionsFilterState
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.tab) params.set("tab", state.tab);
  if (state.clientId) params.set("client", state.clientId);
  if (state.country) params.set("country", state.country);
  return params;
}
