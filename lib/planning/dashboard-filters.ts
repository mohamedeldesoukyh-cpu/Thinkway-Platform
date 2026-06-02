import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import { DEFAULT_ANALYTICS_FILTERS } from "@/lib/analytics/types/filters";

export type PlanningFilterState = {
  fiscalYear?: string;
  period?: string;
  country?: string;
  clientId?: string;
  brandId?: string;
  businessUnitId?: string;
  teamId?: string;
  scenarioId?: string;
  versionId?: string;
  forecastId?: string;
  tab?: string;
};

export function parsePlanningSearchParams(
  params: Record<string, string | string[] | undefined>
): PlanningFilterState {
  const pick = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };

  return {
    fiscalYear: pick("fy"),
    period: pick("period"),
    country: pick("country"),
    clientId: pick("client"),
    brandId: pick("brand"),
    businessUnitId: pick("bu"),
    teamId: pick("team"),
    scenarioId: pick("scenario"),
    versionId: pick("version"),
    forecastId: pick("forecast"),
    tab: pick("tab"),
  };
}

export function planningFiltersToAnalytics(
  state: PlanningFilterState
): AnalyticsQueryFilters {
  const filters: AnalyticsQueryFilters = { ...DEFAULT_ANALYTICS_FILTERS };

  if (state.country) filters.countryCodes = [state.country];
  if (state.clientId) filters.clientIds = [state.clientId];
  if (state.brandId) filters.brandIds = [state.brandId];
  if (state.teamId) filters.teamIds = [state.teamId];

  return filters;
}

export function serializePlanningFilters(state: PlanningFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.fiscalYear) params.set("fy", state.fiscalYear);
  if (state.period) params.set("period", state.period);
  if (state.country) params.set("country", state.country);
  if (state.clientId) params.set("client", state.clientId);
  if (state.brandId) params.set("brand", state.brandId);
  if (state.businessUnitId) params.set("bu", state.businessUnitId);
  if (state.teamId) params.set("team", state.teamId);
  if (state.scenarioId) params.set("scenario", state.scenarioId);
  if (state.versionId) params.set("version", state.versionId);
  if (state.forecastId) params.set("forecast", state.forecastId);
  if (state.tab) params.set("tab", state.tab);
  return params;
}
