/**
 * Impressions forecasting for Campaign Performance.
 * When provider impressions are unavailable, estimate from views or effective reach.
 */

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

export type ImpressionsSource = "actual" | "forecast" | "manual";

export type ImpressionsForecastMethod =
  | "views_multiplier"
  | "reach_multiplier";

export type ImpressionsForecastResult = {
  forecastImpressions: number | null;
  method: ImpressionsForecastMethod | null;
  /** Human-readable formula label for tooltips. */
  formula: string | null;
};

export const IMPRESSIONS_FORECAST_DISCLAIMER =
  "Impression totals include actual provider data and forecasted estimates where provider impressions were unavailable. Forecast formulas vary by platform and content type. Impressions source is shown per publication.";

export const IMPRESSIONS_SOURCE_LABELS: Record<ImpressionsSource, string> = {
  actual: "Actual",
  forecast: "Forecast",
  manual: "Manual",
};

type ContentFormula = {
  method: ImpressionsForecastMethod;
  multiplier: number;
  basis: "views" | "reach";
  formula: string;
};

const REEL_TYPES = new Set(["instagram_reel", "ig_reel", "reel"]);
const POST_TYPES = new Set([
  "instagram_post",
  "ig_post",
  "photo",
  "carousel",
  "ig_post_carousel",
]);
const TIKTOK_VIDEO_TYPES = new Set(["tiktok_video", "tt_video"]);

function normalizePublicationType(
  platform: string | null | undefined,
  publicationType: string | null | undefined
): string {
  const type = (publicationType ?? "").trim().toLowerCase();
  if (type) return type;

  const platformKey = canonicalPlatformKey(platform ?? "");
  if (platformKey === "instagram") return "instagram_post";
  if (platformKey === "tiktok") return "tiktok_video";
  return type;
}

function formulaForContentType(
  platform: string | null | undefined,
  publicationType: string | null | undefined
): ContentFormula | null {
  const normalized = normalizePublicationType(platform, publicationType);
  const platformKey = canonicalPlatformKey(platform ?? "");

  if (REEL_TYPES.has(normalized) || (platformKey === "instagram" && normalized.includes("reel"))) {
    return {
      method: "views_multiplier",
      multiplier: 1.15,
      basis: "views",
      formula: "views × 1.15",
    };
  }

  if (POST_TYPES.has(normalized)) {
    return {
      method: "reach_multiplier",
      multiplier: 1.25,
      basis: "reach",
      formula: "reach × 1.25",
    };
  }

  if (TIKTOK_VIDEO_TYPES.has(normalized) || platformKey === "tiktok") {
    return {
      method: "views_multiplier",
      multiplier: 1.1,
      basis: "views",
      formula: "views × 1.10",
    };
  }

  if (platformKey === "instagram") {
    return {
      method: "reach_multiplier",
      multiplier: 1.25,
      basis: "reach",
      formula: "reach × 1.25",
    };
  }

  return null;
}

function positiveMetric(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function computeImpressionsForecast(input: {
  platform?: string | null;
  publication_type?: string | null;
  views?: number | null;
  /** Effective reach (actual, forecast, or manual). */
  effectiveReach?: number | null;
}): ImpressionsForecastResult {
  const formula = formulaForContentType(input.platform, input.publication_type);
  if (!formula) {
    return { forecastImpressions: null, method: null, formula: null };
  }

  const basisValue =
    formula.basis === "views"
      ? positiveMetric(input.views)
      : positiveMetric(input.effectiveReach);

  if (basisValue == null) {
    return { forecastImpressions: null, method: formula.method, formula: formula.formula };
  }

  return {
    forecastImpressions: Math.round(basisValue * formula.multiplier),
    method: formula.method,
    formula: formula.formula,
  };
}

export type ImpressionsSnapshot = {
  impressions: number | null;
  impressions_source: ImpressionsSource | null;
  actual_impressions: number | null;
  forecast_impressions: number | null;
  forecast_method: ImpressionsForecastMethod | null;
  forecast_formula: string | null;
};

export type ResolveImpressionsInput = {
  providerImpressions?: number | null;
  manualImpressions?: number | null;
  storedImpressions?: number | null;
  storedImpressionsSource?: ImpressionsSource | null;
  storedActualImpressions?: number | null;
  storedForecastImpressions?: number | null;
  platform?: string | null;
  publication_type?: string | null;
  views?: number | null;
  /** Resolved reach for this sync (includes forecast/manual). */
  effectiveReach?: number | null;
  isManualSource?: boolean;
};

/**
 * Priority: manual → actual provider → forecast → null.
 */
export function resolveImpressionsSnapshot(input: ResolveImpressionsInput): ImpressionsSnapshot {
  const providerImpressions = positiveMetric(input.providerImpressions);
  const manualImpressions = positiveMetric(input.manualImpressions);
  const storedForecast = positiveMetric(input.storedForecastImpressions);
  const storedActual = positiveMetric(input.storedActualImpressions);

  const forecast = computeImpressionsForecast({
    platform: input.platform,
    publication_type: input.publication_type,
    views: input.views,
    effectiveReach: input.effectiveReach,
  });

  if (input.isManualSource && manualImpressions != null) {
    return {
      impressions: manualImpressions,
      impressions_source: "manual",
      actual_impressions: storedActual,
      forecast_impressions: storedForecast,
      forecast_method: null,
      forecast_formula: null,
    };
  }

  if (providerImpressions != null) {
    const preservedForecast =
      storedForecast ??
      (input.storedImpressionsSource === "forecast"
        ? positiveMetric(input.storedImpressions)
        : null);
    return {
      impressions: providerImpressions,
      impressions_source: "actual",
      actual_impressions: providerImpressions,
      forecast_impressions: preservedForecast,
      forecast_method: null,
      forecast_formula: null,
    };
  }

  if (input.storedImpressionsSource === "manual" && positiveMetric(input.storedImpressions) != null) {
    return {
      impressions: positiveMetric(input.storedImpressions),
      impressions_source: "manual",
      actual_impressions: storedActual,
      forecast_impressions: storedForecast,
      forecast_method: null,
      forecast_formula: null,
    };
  }

  if (storedActual != null || input.storedImpressionsSource === "actual") {
    const actual = storedActual ?? positiveMetric(input.storedImpressions);
    if (actual != null) {
      return {
        impressions: actual,
        impressions_source: "actual",
        actual_impressions: actual,
        forecast_impressions: storedForecast,
        forecast_method: null,
        forecast_formula: null,
      };
    }
  }

  if (forecast.forecastImpressions != null) {
    return {
      impressions: forecast.forecastImpressions,
      impressions_source: "forecast",
      actual_impressions: storedActual,
      forecast_impressions: forecast.forecastImpressions,
      forecast_method: forecast.method,
      forecast_formula: forecast.formula,
    };
  }

  return {
    impressions: null,
    impressions_source: null,
    actual_impressions: storedActual,
    forecast_impressions: storedForecast,
    forecast_method: null,
    forecast_formula: null,
  };
}

export function impressionsSourceTooltip(
  source: ImpressionsSource | null | undefined,
  formula?: string | null
): string | null {
  switch (source) {
    case "actual":
      return "Impressions reported by the metrics provider.";
    case "forecast":
      return formula
        ? `Impressions estimated (${formula}) because provider impressions were unavailable.`
        : "Impressions estimated from views or reach because provider impressions were unavailable.";
    case "manual":
      return "Impressions were manually entered or imported.";
    default:
      return null;
  }
}

export function impressionsSourceBadgeClass(source: ImpressionsSource | null | undefined): string {
  switch (source) {
    case "actual":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
    case "forecast":
      return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "manual":
      return "border-[#0057FF]/30 bg-[#EEF4FF] text-[#0057FF]";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function impressionsSourceTextClass(source: ImpressionsSource | null | undefined): string {
  switch (source) {
    case "actual":
      return "thinkway-campaign-c-green";
    case "forecast":
      return "thinkway-campaign-c-amber";
    case "manual":
      return "thinkway-campaign-c-blue";
    default:
      return "thinkway-campaign-c-gray";
  }
}
