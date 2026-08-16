/**
 * Unified engagement & engagement-rate calculation for Campaign Performance.
 * All UI, reports, exports, APIs, and dashboards must use this module.
 */

export type EngagementRateMethod = "views" | "reach" | "followers" | "manual" | "unknown";

export type EngagementRateInput = {
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  /** Platform-matched creator follower count (e.g. influencer_platform_accounts.follower_count). */
  followers?: number | null;
  /** Explicit manual ER override (%). Takes priority over automatic denominators when set. */
  manualEngagementRate?: number | null;
};

export type EngagementSnapshot = {
  engagements: number;
  engagement_rate: number | null;
  engagement_rate_method: EngagementRateMethod;
};

export const ENGAGEMENT_RATE_METHOD_LABELS: Record<EngagementRateMethod, string> = {
  views: "Views",
  reach: "Reach",
  followers: "Followers Estimate",
  manual: "Manual",
  unknown: "Unknown",
};

function coalesceMetric(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function positiveMetric(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** engagements = likes + comments + shares + saves (null/negative treated as 0). */
export function computeEngagements(input: EngagementRateInput): number {
  return (
    coalesceMetric(input.likes) +
    coalesceMetric(input.comments) +
    coalesceMetric(input.shares) +
    coalesceMetric(input.saves)
  );
}

export function computeEngagementRate(input: EngagementRateInput): {
  engagement_rate: number | null;
  engagement_rate_method: EngagementRateMethod;
} {
  const engagements = computeEngagements(input);
  const manualRate = positiveMetric(input.manualEngagementRate);
  if (manualRate != null) {
    return { engagement_rate: manualRate, engagement_rate_method: "manual" };
  }

  if (engagements <= 0) {
    return { engagement_rate: null, engagement_rate_method: "unknown" };
  }

  const views = positiveMetric(input.views);
  if (views != null) {
    return {
      engagement_rate: (engagements / views) * 100,
      engagement_rate_method: "views",
    };
  }

  const reach = positiveMetric(input.reach);
  if (reach != null) {
    return {
      engagement_rate: (engagements / reach) * 100,
      engagement_rate_method: "reach",
    };
  }

  const followers = positiveMetric(input.followers);
  if (followers != null) {
    return {
      engagement_rate: (engagements / followers) * 100,
      engagement_rate_method: "followers",
    };
  }

  return { engagement_rate: null, engagement_rate_method: "unknown" };
}

export function computeEngagementSnapshot(input: EngagementRateInput): EngagementSnapshot {
  const engagements = computeEngagements(input);
  const { engagement_rate, engagement_rate_method } = computeEngagementRate(input);
  return { engagements, engagement_rate, engagement_rate_method };
}

export function engagementRateMethodTooltip(method: EngagementRateMethod): string | null {
  switch (method) {
    case "followers":
      return "Engagement rate is currently calculated using follower count because view data is unavailable.";
    case "reach":
      return "Engagement rate is calculated using reach as the denominator.";
    case "views":
      return "Engagement rate is calculated using views as the denominator.";
    case "manual":
      return "Engagement rate was manually overridden.";
    default:
      return null;
  }
}

/** Instagram static posts / carousels often have no public view count. */
export function isInstagramPhotoOrCarousel(
  platform: string | null | undefined,
  publicationType: string | null | undefined
): boolean {
  const p = (platform ?? "").trim().toLowerCase();
  if (p !== "instagram" && p !== "ig") return false;
  const t = (publicationType ?? "").trim().toLowerCase();
  return (
    t === "instagram_post" ||
    t === "photo" ||
    t === "carousel" ||
    t === "ig_post" ||
    t === "ig_post_carousel"
  );
}

export function isInstagramHiddenLikes(
  platform: string | null | undefined,
  likes: number | null | undefined,
  rawLikes?: unknown,
  options?: { hasOtherEngagement?: boolean }
): boolean {
  const p = (platform ?? "").trim().toLowerCase();
  if (p !== "instagram" && p !== "ig") return false;
  if (rawLikes === -1 || rawLikes === "-1") return true;
  if (likes == null && options?.hasOtherEngagement) return true;
  return false;
}

export type MetricsRefreshContext = {
  platform?: string | null;
  publication_type?: string | null;
};

/**
 * Completed when core metrics exist, with Instagram photo/carousel exception
 * (likes OR comments sufficient when views unavailable).
 */
export function metricsRefreshStatusForEngagement(
  input: EngagementRateInput,
  context?: MetricsRefreshContext
): "completed" | "partial" {
  const views = positiveMetric(input.views);
  const likes = positiveMetric(input.likes);
  const comments = positiveMetric(input.comments);

  if (views != null || likes != null || comments != null) {
    if (
      isInstagramPhotoOrCarousel(context?.platform, context?.publication_type) &&
      views == null &&
      (likes != null || comments != null)
    ) {
      return "completed";
    }
    if (views != null || likes != null || comments != null) {
      return "completed";
    }
  }

  return "partial";
}

export type MetricsSourceBadge = "automatic" | "manual" | "mixed";

export function metricsSourceBadge(
  metricsProvider: string | null | undefined,
  engagementRateMethod: EngagementRateMethod | null | undefined
): MetricsSourceBadge {
  const provider = (metricsProvider ?? "").trim().toLowerCase();
  const method = engagementRateMethod ?? "unknown";
  if (provider === "manual" && method === "manual") return "manual";
  if (provider === "manual" && method !== "manual") return "mixed";
  if (method === "manual") return "manual";
  if (provider && provider !== "manual" && provider !== "unknown") return "automatic";
  return "automatic";
}

export function metricsSourceBadgeLabel(badge: MetricsSourceBadge): string {
  switch (badge) {
    case "manual":
      return "Manual";
    case "mixed":
      return "Mixed";
    default:
      return "Automatic";
  }
}

/**
 * Campaign / group Avg ER: sum of all publication ERs (incl. added value),
 * divided by agreed publication count only (added value excluded from n).
 */
export function averageEngagementRateAgainstAgreed(
  engagementRates: ReadonlyArray<number | null | undefined>,
  agreedPublicationCount: number
): number | null {
  const values = engagementRates.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
  if (values.length === 0 || agreedPublicationCount <= 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / agreedPublicationCount;
}
