/**
 * Reach forecasting for Campaign Performance.
 * When provider reach is unavailable, estimate from creator followers × content-type multiplier.
 */

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

export type ReachSource = "actual" | "forecast" | "manual";

export type ReachForecastConfidence = "low" | "medium" | "high";

export type ReachForecastMethod = "followers_estimate";

export type ReachForecastResult = {
  forecastReach: number | null;
  confidence: ReachForecastConfidence;
  method: ReachForecastMethod;
};

export const REACH_FORECAST_DISCLAIMER =
  "Reach totals include actual provider data and forecasted estimates where provider reach was unavailable. Forecasted reach is calculated from creator follower count and content type. Reach source is shown per publication.";

export const REACH_SOURCE_LABELS: Record<ReachSource, string> = {
  actual: "Actual",
  forecast: "Forecast",
  manual: "Manual",
};

/** Default reach multipliers (followers × rate). */
const REACH_MULTIPLIERS: Record<string, number> = {
  instagram_post: 0.3,
  ig_post: 0.3,
  photo: 0.3,
  instagram_reel: 0.45,
  ig_reel: 0.45,
  reel: 0.45,
  tiktok_video: 0.55,
  tt_video: 0.55,
  instagram_story: 0.12,
  ig_story: 0.12,
  story: 0.12,
  carousel: 0.28,
  ig_post_carousel: 0.28,
};

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

export function reachMultiplierForContentType(
  platform: string | null | undefined,
  publicationType: string | null | undefined
): number | null {
  const normalized = normalizePublicationType(platform, publicationType);
  if (!normalized) return null;
  return REACH_MULTIPLIERS[normalized] ?? null;
}

function positiveFollowers(followers: number | null | undefined): number | null {
  if (followers == null || !Number.isFinite(followers) || followers <= 0) return null;
  return followers;
}

export function computeReachForecast(input: {
  followers?: number | null;
  platform?: string | null;
  publication_type?: string | null;
  content_type?: string | null;
}): ReachForecastResult {
  const followers = positiveFollowers(input.followers);
  const publicationType = input.publication_type ?? input.content_type ?? null;
  const multiplier = reachMultiplierForContentType(input.platform, publicationType);

  if (followers == null || multiplier == null) {
    return { forecastReach: null, confidence: "low", method: "followers_estimate" };
  }

  const forecastReach = Math.round(followers * multiplier);
  const confidence: ReachForecastConfidence =
    followers >= 10_000 ? "high" : followers >= 1_000 ? "medium" : "low";

  return { forecastReach, confidence, method: "followers_estimate" };
}

export type ReachSnapshot = {
  reach: number | null;
  reach_source: ReachSource | null;
  actual_reach: number | null;
  forecast_reach: number | null;
  forecast_confidence: ReachForecastConfidence | null;
  forecast_method: ReachForecastMethod | null;
};

export type ResolveReachInput = {
  /** Reach from metrics provider in this sync/import. */
  providerReach?: number | null;
  /** Explicit manual reach from user import/edit. */
  manualReach?: number | null;
  /** Previously stored values. */
  storedReach?: number | null;
  storedReachSource?: ReachSource | null;
  storedActualReach?: number | null;
  storedForecastReach?: number | null;
  followers?: number | null;
  platform?: string | null;
  publication_type?: string | null;
  /** True when metrics source is manual or manual_import. */
  isManualSource?: boolean;
};

function positiveReach(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Priority: manual → actual provider → forecast → null.
 * Preserves forecast_reach when actual replaces a prior forecast.
 */
export function resolveReachSnapshot(input: ResolveReachInput): ReachSnapshot {
  const providerReach = positiveReach(input.providerReach);
  const manualReach = positiveReach(input.manualReach);
  const storedForecast = positiveReach(input.storedForecastReach);
  const storedActual = positiveReach(input.storedActualReach);

  const forecast = computeReachForecast({
    followers: input.followers,
    platform: input.platform,
    publication_type: input.publication_type,
  });

  if (input.isManualSource && manualReach != null) {
    return {
      reach: manualReach,
      reach_source: "manual",
      actual_reach: storedActual,
      forecast_reach: storedForecast,
      forecast_confidence: null,
      forecast_method: null,
    };
  }

  if (providerReach != null) {
    const preservedForecast =
      storedForecast ??
      (input.storedReachSource === "forecast" ? positiveReach(input.storedReach) : null);
    return {
      reach: providerReach,
      reach_source: "actual",
      actual_reach: providerReach,
      forecast_reach: preservedForecast,
      forecast_confidence: null,
      forecast_method: null,
    };
  }

  // Provider sync without reach — keep manual if already manual
  if (input.storedReachSource === "manual" && positiveReach(input.storedReach) != null) {
    return {
      reach: positiveReach(input.storedReach),
      reach_source: "manual",
      actual_reach: storedActual,
      forecast_reach: storedForecast,
      forecast_confidence: null,
      forecast_method: null,
    };
  }

  // Keep stored actual when provider did not return reach this run
  if (storedActual != null || input.storedReachSource === "actual") {
    const actual = storedActual ?? positiveReach(input.storedReach);
    if (actual != null) {
      return {
        reach: actual,
        reach_source: "actual",
        actual_reach: actual,
        forecast_reach: storedForecast,
        forecast_confidence: null,
        forecast_method: null,
      };
    }
  }

  if (forecast.forecastReach != null) {
    return {
      reach: forecast.forecastReach,
      reach_source: "forecast",
      actual_reach: storedActual,
      forecast_reach: forecast.forecastReach,
      forecast_confidence: forecast.confidence,
      forecast_method: forecast.method,
    };
  }

  return {
    reach: null,
    reach_source: null,
    actual_reach: storedActual,
    forecast_reach: storedForecast,
    forecast_confidence: null,
    forecast_method: null,
  };
}

export function reachSourceTooltip(source: ReachSource | null | undefined): string | null {
  switch (source) {
    case "actual":
      return "Reach reported by the metrics provider.";
    case "forecast":
      return "Reach estimated from creator follower count and content type because provider data was unavailable.";
    case "manual":
      return "Reach was manually entered or imported.";
    default:
      return null;
  }
}

export function reachSourceBadgeClass(source: ReachSource | null | undefined): string {
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

export function reachSourceTextClass(source: ReachSource | null | undefined): string {
  switch (source) {
    case "actual":
      return "text-emerald-700 dark:text-emerald-400";
    case "forecast":
      return "text-amber-700 dark:text-amber-400";
    case "manual":
      return "text-[#0057FF]";
    default:
      return "text-[#5B6575]";
  }
}
