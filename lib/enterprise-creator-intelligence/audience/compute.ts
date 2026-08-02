import {
  classifyAudienceQuality,
  classifyAudienceStability,
  classifyGrowthTrend,
  detectSpikesAndDrops,
  normalizePercentSlices,
} from "@/lib/enterprise-creator-intelligence/audience/classify";
import type {
  AnalysisWindowKey,
  AudienceConfidence,
  AudienceDemographicsBundle,
  AudienceEngagementBehaviour,
  AudienceGeographyInsight,
  AudienceGrowthInsight,
  AudienceLanguageInsight,
  AudienceSource,
  CreatorAudienceIntelligence,
  DistributionSlice,
  WindowAudienceBundle,
} from "@/lib/enterprise-creator-intelligence/audience/types";
import {
  AUDIENCE_CONSUMERS,
  AUDIENCE_WINDOWS,
} from "@/lib/enterprise-creator-intelligence/audience/types";
import type { CreatorMonthlyMetrics } from "@/lib/enterprise-creator-intelligence/historical/types";
import { windowDaySpan } from "@/lib/enterprise-creator-intelligence/category-brand/windows";

export type AudienceDemographicFact = {
  genderMale: number | null;
  genderFemale: number | null;
  genderUnknown: number | null;
  age13_17: number | null;
  age18_24: number | null;
  age25_34: number | null;
  age35_44: number | null;
  age45_54: number | null;
  age55Plus: number | null;
  topCountries: Array<{ code?: string; name?: string; percent?: number }> | null;
  topCities: Array<{ name?: string; percent?: number }> | null;
  demographicSource: string | null;
  languages: string[];
  authenticityScore: number | null;
};

export type AudienceEngagementFact = {
  shareTrend: string | null;
  saveTrend: string | null;
  interactionTrend: string | null;
  engagementTrend: string | null;
  stabilityHint: string | null;
};

export type CreatorAudienceFacts = {
  influencerId: string;
  platform: string | null;
  computedAt?: string;
  demographics: AudienceDemographicFact;
  monthlyMetrics: CreatorMonthlyMetrics[];
  engagement: AudienceEngagementFact;
};

function buildConfidence(
  sampleCount: number,
  window: AnalysisWindowKey,
  extras: AudienceConfidence["basedOn"] = []
): AudienceConfidence {
  const days = windowDaySpan(window);
  const basedOn = [
    { label: "samples", value: sampleCount },
    { label: "days", value: days },
    ...extras,
  ];
  const percent =
    sampleCount <= 0
      ? null
      : Math.round(
          Math.min(100, Math.min(sampleCount / 12, 1) * 60 + Math.min(days / 180, 1) * 40)
        );
  return {
    percent,
    reason: `Based on ${sampleCount} samples, ${days}-day window context.`,
    basedOn,
  };
}

function buildSource(input: {
  platform: string | null;
  refreshTime: string | null;
  confidence: number | null;
  method?: string;
}): AudienceSource {
  return {
    platform: input.platform,
    collectionMethod:
      input.method ??
      "Influencer demographics + Sprint 1 monthly follower history + performance engagement signals",
    refreshTime: input.refreshTime,
    confidence: input.confidence,
  };
}

function monthsForWindow(
  months: CreatorMonthlyMetrics[],
  window: AnalysisWindowKey,
  asOfMs: number
): CreatorMonthlyMetrics[] {
  if (window === "lifetime") return months;
  const days = windowDaySpan(window);
  const cutoff = asOfMs - days * 24 * 60 * 60 * 1000;
  return months.filter((m) => {
    const t = new Date(`${m.periodMonth}T00:00:00.000Z`).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

function buildDemographics(
  demo: AudienceDemographicFact,
  platform: string | null,
  lastUpdated: string,
  window: AnalysisWindowKey
): AudienceDemographicsBundle {
  const gender = normalizePercentSlices([
    { key: "male", label: "Male", value: demo.genderMale },
    { key: "female", label: "Female", value: demo.genderFemale },
    { key: "unknown", label: "Unknown", value: demo.genderUnknown },
  ]);
  const age = normalizePercentSlices([
    { key: "13_17", label: "13–17", value: demo.age13_17 },
    { key: "18_24", label: "18–24", value: demo.age18_24 },
    { key: "25_34", label: "25–34", value: demo.age25_34 },
    { key: "35_44", label: "35–44", value: demo.age35_44 },
    { key: "45_54", label: "45–54", value: demo.age45_54 },
    { key: "55_plus", label: "55+", value: demo.age55Plus },
  ]);
  const countries: DistributionSlice[] = (demo.topCountries ?? []).map((c, i) => ({
    key: c.code ?? c.name ?? `country_${i}`,
    label: c.name ?? c.code ?? `Country ${i + 1}`,
    percent: c.percent == null ? null : Number(c.percent),
  }));
  const cities: DistributionSlice[] = (demo.topCities ?? []).map((c, i) => ({
    key: c.name ?? `city_${i}`,
    label: c.name ?? `City ${i + 1}`,
    percent: c.percent == null ? null : Number(c.percent),
  }));
  const languages: DistributionSlice[] = demo.languages.map((lang, i) => ({
    key: lang,
    label: lang,
    percent: null,
  }));

  const hasGender = gender.some((g) => g.percent != null);
  const hasAge = age.some((a) => a.percent != null);
  const hasCountries = countries.length > 0;
  const sampleCount =
    Number(hasGender) + Number(hasAge) + Number(hasCountries) + languages.length;
  const confidence = buildConfidence(Math.max(sampleCount, demo.demographicSource ? 1 : 0), window, [
    { label: "demographic_source", value: demo.demographicSource ?? "unavailable" },
  ]);
  const source = buildSource({
    platform,
    refreshTime: lastUpdated,
    confidence: confidence.percent,
    method: `Demographic columns from influencers (source=${demo.demographicSource ?? "unavailable"})`,
  });

  const missingInputs: string[] = [];
  if (!hasGender) missingInputs.push("gender_distribution");
  if (!hasAge) missingInputs.push("age_distribution");
  if (!hasCountries) missingInputs.push("country_distribution");
  if (cities.length === 0) missingInputs.push("city_distribution");
  if (languages.length === 0) missingInputs.push("language_distribution");

  return {
    gender,
    age,
    countries,
    cities,
    languages,
    demographicSource: demo.demographicSource,
    confidence,
    source,
    historicalSeriesAvailable: "No",
    missingInputs,
    explainability: {
      value: demo.demographicSource,
      meaning: "Audience demographic snapshot where provider data is available.",
      confidence: confidence.percent,
      evidence: [
        confidence.reason,
        `Source=${demo.demographicSource ?? "unavailable"}`,
      ],
      historicalTrend:
        "Point-in-time demographics reused across windows until historical demographic captures exist.",
      businessContext:
        "Planning uses demographic mix for audience fit — missing slices are explicit.",
      dataSource: source,
      lastUpdated,
      missingInputs,
    },
  };
}

function buildGrowth(
  months: CreatorMonthlyMetrics[],
  platform: string | null,
  lastUpdated: string,
  window: AnalysisWindowKey
): AudienceGrowthInsight {
  const sorted = [...months].sort((a, b) =>
    a.periodMonth.localeCompare(b.periodMonth)
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const followerGrowth =
    first?.followers != null && last?.followers != null
      ? last.followers - first.followers
      : null;
  const growthRates = sorted
    .map((m) => m.monthlyGrowthRate)
    .filter((v): v is number => v != null);
  const latestGrowth = growthRates[growthRates.length - 1] ?? null;
  const growthPercent =
    latestGrowth == null ? null : Number((latestGrowth * 100).toFixed(2));
  const growthTrend = classifyGrowthTrend({
    growthRates,
    latestGrowth,
  });
  const { spikes, drops } = detectSpikesAndDrops(
    sorted.map((m) => ({
      at: m.periodMonth,
      growthRate: m.monthlyGrowthRate,
    }))
  );

  // Organic growth proxy = total growth excluding spike months (supported indicator, not paid/organic truth).
  const organicGrowth =
    followerGrowth == null
      ? null
      : followerGrowth -
        spikes.reduce((sum, s) => {
          const month = sorted.find((m) => m.periodMonth === s.at);
          return sum + (month?.followerDifference ?? 0);
        }, 0);

  const confidence = buildConfidence(sorted.length, window, [
    { label: "months", value: sorted.length },
  ]);
  const source = buildSource({
    platform,
    refreshTime: lastUpdated,
    confidence: confidence.percent,
    method: "Sprint 1 creator_intelligence_monthly_metrics follower series",
  });

  const whatChanged =
    followerGrowth == null
      ? "Follower growth unavailable for this window."
      : `Followers changed by ${followerGrowth} (${growthPercent ?? "n/a"}% latest month).`;
  const why =
    sorted.length === 0
      ? "No monthly follower history in window."
      : `Derived from ${sorted.length} monthly historical captures.`;
  const businessImplication =
    growthTrend === "Growing" || growthTrend === "Spike"
      ? "Audience is expanding — confirm quality/stability before scaling briefs."
      : growthTrend === "Declining" || growthTrend === "Drop"
        ? "Audience contraction detected — validate fit and recent content quality."
        : "Audience size movement is limited — use stability for Planning trust.";

  return {
    followerGrowth,
    growthPercent,
    growthTrend,
    organicGrowth,
    suddenSpikes: spikes,
    suddenDrops: drops,
    whatChanged,
    why,
    businessImplication,
    confidence,
    source,
    explainability: {
      value: growthPercent,
      meaning: "Audience growth from historical follower time-series.",
      confidence: confidence.percent,
      evidence: [
        whatChanged,
        `${spikes.length} spikes`,
        `${drops.length} drops`,
        confidence.reason,
      ],
      historicalTrend: whatChanged,
      businessContext: businessImplication,
      dataSource: source,
      lastUpdated,
      missingInputs: sorted.length === 0 ? ["monthly_follower_history"] : [],
    },
  };
}

function buildGeography(
  demo: AudienceDemographicFact,
  platform: string | null,
  lastUpdated: string
): AudienceGeographyInsight {
  const countries = (demo.topCountries ?? []).map((c, i) => ({
    key: c.code ?? c.name ?? `country_${i}`,
    label: c.name ?? c.code ?? `Country ${i + 1}`,
    percent: c.percent == null ? null : Number(c.percent),
  }));
  const cities = (demo.topCities ?? []).map((c, i) => ({
    key: c.name ?? `city_${i}`,
    label: c.name ?? `City ${i + 1}`,
    percent: c.percent == null ? null : Number(c.percent),
  }));
  const confidence = buildConfidence(countries.length + cities.length, "lifetime", [
    { label: "countries", value: countries.length },
    { label: "cities", value: cities.length },
  ]);
  const source = buildSource({
    platform,
    refreshTime: lastUpdated,
    confidence: confidence.percent,
    method: "Audience top countries/cities from influencer demographic columns",
  });
  const primaryCountries = countries.slice(0, 3).map((c) => c.label);
  const primaryCities = cities.slice(0, 3).map((c) => c.label);

  return {
    primaryCountries,
    primaryCities,
    regionalDistribution: countries,
    historicalChanges:
      "Geography snapshot only — historical geo series requires future demographic captures.",
    confidence,
    source,
    explainability: {
      value: primaryCountries[0] ?? null,
      meaning: "Primary audience geography for Planning briefs.",
      confidence: confidence.percent,
      evidence: [
        `Primary countries: ${primaryCountries.join(", ") || "none"}`,
        `Primary cities: ${primaryCities.join(", ") || "none"}`,
      ],
      historicalTrend:
        "No historical geography movement until append-only demographic history accumulates.",
      businessContext:
        "Geography readiness informs market fit for Client/Planning workspaces.",
      dataSource: source,
      lastUpdated,
      missingInputs: [
        ...(countries.length === 0 ? ["countries"] : []),
        ...(cities.length === 0 ? ["cities"] : []),
      ],
    },
  };
}

function buildLanguages(
  demo: AudienceDemographicFact,
  platform: string | null,
  lastUpdated: string
): AudienceLanguageInsight {
  const langs = demo.languages.map((l) => l.trim()).filter(Boolean);
  const primary = langs[0] ?? null;
  const secondary = langs.slice(1, 3);
  const emerging = langs.slice(3, 5);
  const mix = langs.map((language, index) => ({
    language,
    role:
      index === 0
        ? ("Primary" as const)
        : index < 3
          ? ("Secondary" as const)
          : ("Emerging" as const),
    percent: null as number | null,
  }));
  const confidence = buildConfidence(langs.length, "lifetime", [
    { label: "languages", value: langs.length },
  ]);
  const source = buildSource({
    platform,
    refreshTime: lastUpdated,
    confidence: confidence.percent,
    method: "Language codes from creator DNA / projection when available",
  });

  return {
    primary,
    secondary,
    emerging,
    mix,
    historicalMovement:
      "Language mix snapshot only — movement requires historical language captures.",
    confidence,
    source,
    explainability: {
      value: primary,
      meaning: "Audience language mix for content and market planning.",
      confidence: confidence.percent,
      evidence: [
        `Primary=${primary ?? "none"}`,
        `Secondary=${secondary.join(", ") || "none"}`,
        `Emerging=${emerging.join(", ") || "none"}`,
      ],
      historicalTrend: "No historical language movement available yet.",
      businessContext: "Language readiness supports bilingual/MENA brief planning.",
      dataSource: source,
      lastUpdated,
      missingInputs: langs.length === 0 ? ["languages"] : [],
    },
  };
}

function buildEngagementBehaviour(
  engagement: AudienceEngagementFact,
  platform: string | null,
  lastUpdated: string
): AudienceEngagementBehaviour {
  const hasAny =
    Boolean(engagement.shareTrend) ||
    Boolean(engagement.saveTrend) ||
    Boolean(engagement.interactionTrend) ||
    Boolean(engagement.engagementTrend);
  const confidence = buildConfidence(hasAny ? 4 : 0, "lifetime");
  const source = buildSource({
    platform,
    refreshTime: lastUpdated,
    confidence: confidence.percent,
    method: "Historical audience response signals from Performance Intelligence",
  });

  const consistency =
    engagement.stabilityHint === "Highly Stable" ||
    engagement.stabilityHint === "Stable" ||
    engagement.stabilityHint === "Volatile" ||
    engagement.stabilityHint === "Recovering" ||
    engagement.stabilityHint === "Seasonal"
      ? (engagement.stabilityHint as AudienceEngagementBehaviour["engagementConsistency"])
      : ("Unknown" as const);

  return {
    engagementConsistency: consistency,
    returningEngagement: "Unavailable",
    interactionTrend: engagement.interactionTrend ?? "Unknown",
    shareBehaviour: engagement.shareTrend ?? "Unknown",
    saveBehaviour: engagement.saveTrend ?? "Unknown",
    confidence,
    missingInputs: hasAny ? ["returning_engagement"] : ["performance_audience_response"],
    explainability: {
      value: engagement.engagementTrend,
      meaning: "Historical audience engagement behaviour only — no prediction.",
      confidence: confidence.percent,
      evidence: [
        `Engagement trend=${engagement.engagementTrend ?? "n/a"}`,
        `Share=${engagement.shareTrend ?? "n/a"}`,
        `Save=${engagement.saveTrend ?? "n/a"}`,
        "Returning engagement not available in current data model.",
      ],
      historicalTrend: engagement.engagementTrend ?? "Unknown",
      businessContext:
        "Behaviour signals help Planning judge whether the audience actively responds.",
      dataSource: source,
      lastUpdated,
      missingInputs: hasAny ? ["returning_engagement"] : ["performance_audience_response"],
    },
  };
}

/** Pure Audience Intelligence computation. */
export function computeCreatorAudienceIntelligence(
  facts: CreatorAudienceFacts
): CreatorAudienceIntelligence {
  const computedAt = facts.computedAt ?? new Date().toISOString();
  const asOfMs = new Date(computedAt).getTime();
  const demo = facts.demographics;

  const windows = {} as Record<AnalysisWindowKey, WindowAudienceBundle>;
  for (const window of AUDIENCE_WINDOWS) {
    const monthSlice = monthsForWindow(facts.monthlyMetrics, window, asOfMs);
    const demographics = buildDemographics(
      demo,
      facts.platform,
      computedAt,
      window
    );
    const growth = buildGrowth(monthSlice, facts.platform, computedAt, window);
    windows[window] = {
      window,
      demographics,
      growth,
      missingInputs: [
        ...new Set([
          ...demographics.missingInputs,
          ...growth.explainability.missingInputs,
        ]),
      ],
    };
  }

  const qualityClass = classifyAudienceQuality({
    demographicSource: demo.demographicSource,
    hasGender: demo.genderMale != null || demo.genderFemale != null,
    hasAge:
      demo.age18_24 != null ||
      demo.age25_34 != null ||
      demo.age35_44 != null,
    hasCountries: (demo.topCountries?.length ?? 0) > 0,
    authenticityScore: demo.authenticityScore,
  });
  const qualityConfidence = buildConfidence(
    qualityClass.indicators.length,
    "lifetime",
    qualityClass.indicators.map((i) => ({ label: "indicator", value: i }))
  );
  const qualitySource = buildSource({
    platform: facts.platform,
    refreshTime: computedAt,
    confidence: qualityConfidence.percent,
    method: "Supported quality indicators only — no fake-follower estimation",
  });
  const quality = {
    level: qualityClass.level,
    meaning: `Audience quality is ${qualityClass.level}.`,
    fakeFollowerEstimation: {
      available: false as const,
      note: "Fake-follower estimation is not implemented and must not be inferred.",
    },
    supportedIndicators: qualityClass.indicators,
    confidence: qualityConfidence,
    explainability: {
      value: qualityClass.level,
      meaning: `Audience quality is ${qualityClass.level}.`,
      confidence: qualityConfidence.percent,
      evidence: [qualityClass.why, ...qualityClass.indicators],
      historicalTrend: "Quality reflects currently supported demographic/authenticity signals.",
      businessContext: qualityClass.why,
      dataSource: qualitySource,
      lastUpdated: computedAt,
      missingInputs:
        qualityClass.indicators.length === 0 ? ["quality_indicators"] : [],
    },
  };

  const followerSeries = facts.monthlyMetrics
    .map((m) => m.followers)
    .filter((v): v is number => v != null);
  const growthRates = facts.monthlyMetrics
    .map((m) => m.monthlyGrowthRate)
    .filter((v): v is number => v != null);
  const stabilityClass = classifyAudienceStability({
    followerSeries,
    postedAts: facts.monthlyMetrics.map((m) => `${m.periodMonth}T00:00:00.000Z`),
    growthRates,
  });
  const stabilityConfidence = buildConfidence(followerSeries.length, "lifetime");
  const stabilitySource = buildSource({
    platform: facts.platform,
    refreshTime: computedAt,
    confidence: stabilityConfidence.percent,
    method: "Follower series variance + growth trajectory + seasonality signal",
  });
  const stability = {
    level: stabilityClass.level,
    meaning: `Audience stability is ${stabilityClass.level}.`,
    why: stabilityClass.why,
    confidence: stabilityConfidence,
    explainability: {
      value: stabilityClass.level,
      meaning: `Audience stability is ${stabilityClass.level}.`,
      confidence: stabilityConfidence.percent,
      evidence: [stabilityClass.why, `${followerSeries.length} follower points`],
      historicalTrend: windows.lifetime.growth.whatChanged,
      businessContext:
        "Stability informs whether Planning can trust audience size assumptions.",
      dataSource: stabilitySource,
      lastUpdated: computedAt,
      missingInputs: followerSeries.length < 2 ? ["follower_history"] : [],
    },
  };

  const geography = buildGeography(demo, facts.platform, computedAt);
  const languages = buildLanguages(demo, facts.platform, computedAt);
  const engagementBehaviour = buildEngagementBehaviour(
    facts.engagement,
    facts.platform,
    computedAt
  );

  let commercialAudienceReadiness: CreatorAudienceIntelligence["businessReadiness"]["commercialAudienceReadiness"] =
    "Ready";
  if (quality.level === "Unknown" || quality.level === "Low Confidence") {
    commercialAudienceReadiness = "Needs Demographics";
  } else if (followerSeries.length < 2) {
    commercialAudienceReadiness = "Insufficient Growth History";
  } else if (
    (qualityConfidence.percent ?? 0) < 50 ||
    quality.level === "Monitor"
  ) {
    commercialAudienceReadiness = "Limited Confidence";
  }

  const source = buildSource({
    platform: facts.platform,
    refreshTime: computedAt,
    confidence: qualityConfidence.percent,
  });

  const businessReadiness = {
    audienceFit:
      geography.primaryCountries[0] != null
        ? `Primary market ${geography.primaryCountries[0]}${
            languages.primary ? ` · language ${languages.primary}` : ""
          }`
        : "Audience fit limited — geography/language incomplete.",
    audienceStability: stability.level,
    audienceConfidence: qualityConfidence.percent,
    commercialAudienceReadiness,
    geography,
    languages,
    quality: quality.level,
  };

  return {
    influencerId: facts.influencerId,
    platform: facts.platform,
    computedAt,
    windows,
    quality,
    stability,
    engagementBehaviour,
    geography,
    languages,
    businessReadiness,
    source,
    aiHints: {
      available:
        quality.level !== "Unknown" ||
        followerSeries.length > 0 ||
        geography.primaryCountries.length > 0,
      quality: quality.level,
      stability: stability.level,
      growthTrend: windows.lifetime.growth.growthTrend,
      primaryCountry: geography.primaryCountries[0] ?? null,
      recommendRefresh:
        quality.level === "Unknown" && followerSeries.length === 0,
    },
    consumers: AUDIENCE_CONSUMERS,
  };
}
