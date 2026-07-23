/**
 * Maps existing database rows → Creator DNA field candidates (no Apify).
 */

import type { FieldSourceMap } from "@/lib/creator-enrichment/types";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  resolveDefaultMetricsPlatformAccountId,
  type MetricsPlatformAccount,
} from "@/lib/creators/creator-centric";
import { isDisplayableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import { mergeCountryCodes } from "@/lib/creators/country-inference";
import type { NormalizedProfileSnapshot } from "@/lib/intelligence-persistence/types";

import { calculateConfidence, calculateFieldCompleteness } from "./confidence-calculator";
import { resolveFieldDnaSource } from "./field-source-to-dna";
import { mapSnapshotToFieldCandidates } from "../writers/ipl-snapshot-mapper";
import type { DnaFieldCandidate, DnaSource } from "../types";

export type BaselineInfluencerRow = {
  id: string;
  display_name: string;
  status: string;
  country_code: string | null;
  country_codes: string[] | null;
  languages: string[] | null;
  categories: string[] | null;
  email: string | null;
  phone: string | null;
  rate_card: Record<string, unknown> | null;
  exclusivity: string | null;
  thinkway_score: number | null;
  profile_id: string | null;
  primary_avatar_url: string | null;
  default_metrics_platform_account_id: string | null;
  audience_age_13_17: number | null;
  audience_age_18_24: number | null;
  audience_age_25_34: number | null;
  audience_age_35_44: number | null;
  audience_age_45_54: number | null;
  audience_age_55_plus: number | null;
  audience_gender_male: number | null;
  audience_gender_female: number | null;
  audience_top_countries: unknown;
  audience_top_cities: unknown;
  demographic_source: string | null;
  metadata: Record<string, unknown> | null;
};

export type BaselinePlatformAccountRow = MetricsPlatformAccount & {
  id: string;
  influencer_id: string;
  platform: string;
  handle: string;
  username: string | null;
  profile_url: string | null;
  profile_display_name: string | null;
  profile_picture_url: string | null;
  follower_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  engagement_rate: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_views: number | null;
  audience_country: string | null;
  is_verified: boolean | null;
  hashtags: string[] | null;
  mentions: string[] | null;
  interest_categories: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_links: string[] | null;
  recent_publications: unknown;
  field_sources: FieldSourceMap | null;
};

export type BaselineAiScoreRow = {
  category: string | null;
  niche: string | null;
  brand_fit_score: number | null;
  content_quality_score: number | null;
};

export type BaselineIplSnapshotRow = {
  id: string;
  platform_account_id: string | null;
  normalized_snapshot: NormalizedProfileSnapshot;
  snapshot_version: number;
  fetched_at: string;
};

export type BaselineMapperInput = {
  influencer: BaselineInfluencerRow;
  accounts: BaselinePlatformAccountRow[];
  aiScore: BaselineAiScoreRow | null;
  campaignCount: number;
  brandCategories: string[];
  snapshots: BaselineIplSnapshotRow[];
  mergedAt: string;
};

function candidate<T>(
  path: string,
  value: T,
  source: DnaSource,
  updatedAt: string,
  options?: { isVerified?: boolean }
): DnaFieldCandidate<T> {
  const completeness = calculateFieldCompleteness(value);
  return {
    path,
    value,
    confidence: calculateConfidence({
      source,
      hasValue: completeness > 0,
      isVerified: options?.isVerified,
      fieldCompleteness: completeness,
    }),
    source,
    updatedAt,
  };
}

function accountCandidate<T>(
  path: string,
  value: T,
  field: string,
  account: BaselinePlatformAccountRow,
  updatedAt: string,
  options?: { isVerified?: boolean }
): DnaFieldCandidate<T> {
  return candidate(
    path,
    value,
    resolveFieldDnaSource(field, account.field_sources),
    updatedAt,
    options
  );
}

function parseRateCardAmount(rateCard: Record<string, unknown> | null): number | null {
  if (!rateCard) return null;
  for (const key of ["package_rate", "base_rate", "rate"]) {
    const raw = rateCard[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseTopLocations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const codes: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      codes.push(entry.trim());
      continue;
    }
    if (entry && typeof entry === "object") {
      const row = entry as Record<string, unknown>;
      const code = row.code ?? row.name;
      if (typeof code === "string" && code.trim()) {
        codes.push(code.trim());
      }
    }
  }
  return codes;
}

function demographicsAvailable(source: string | null | undefined): boolean {
  return Boolean(source && source !== "unavailable");
}

function buildAgeBands(influencer: BaselineInfluencerRow): Record<string, number> | null {
  const bands: Record<string, number> = {};
  const entries: Array<[string, number | null]> = [
    ["13-17", influencer.audience_age_13_17],
    ["18-24", influencer.audience_age_18_24],
    ["25-34", influencer.audience_age_25_34],
    ["35-44", influencer.audience_age_35_44],
    ["45-54", influencer.audience_age_45_54],
    ["55+", influencer.audience_age_55_plus],
  ];
  for (const [key, value] of entries) {
    if (value != null && Number.isFinite(value)) {
      bands[key] = value;
    }
  }
  return Object.keys(bands).length > 0 ? bands : null;
}

function mapInfluencerCandidates(
  influencer: BaselineInfluencerRow,
  mergedAt: string
): DnaFieldCandidate<unknown>[] {
  const candidates: DnaFieldCandidate<unknown>[] = [];
  const push = <T>(path: string, value: T) => {
    candidates.push(candidate(path, value, "manual", mergedAt));
  };

  push("identity.displayName", influencer.display_name?.trim() || null);

  if (influencer.primary_avatar_url && isDisplayableAvatarUrl(influencer.primary_avatar_url)) {
    push("identity.avatarUrl", influencer.primary_avatar_url);
  }

  const countryCodes = mergeCountryCodes(influencer.country_codes, influencer.country_code);
  if (countryCodes.length > 0) {
    push("audience.country", countryCodes[0] ?? null);
    push("audience.countries", countryCodes);
  }

  if (influencer.languages?.length) {
    push("audience.languages", influencer.languages);
    push("audience.languagePrimary", influencer.languages[0] ?? null);
  }

  if (influencer.categories?.length) {
    push("audience.categories", influencer.categories);
  }

  if (influencer.email) push("contact.email", influencer.email);
  if (influencer.phone) push("contact.phone", influencer.phone);

  const rate = parseRateCardAmount(influencer.rate_card);
  if (rate != null) push("commercial.estimatedRate", rate);
  if (influencer.exclusivity) push("commercial.exclusivity", influencer.exclusivity);

  if (influencer.thinkway_score != null) {
    candidates.push(
      candidate("scores.thinkwayScore", influencer.thinkway_score, "ai_infer", mergedAt)
    );
  }

  if (demographicsAvailable(influencer.demographic_source)) {
    const gender =
      influencer.audience_gender_male != null || influencer.audience_gender_female != null
        ? {
            male: influencer.audience_gender_male ?? 0,
            female: influencer.audience_gender_female ?? 0,
          }
        : null;
    if (gender) push("audience.audienceGender", gender);

    const ageBands = buildAgeBands(influencer);
    if (ageBands) push("audience.audienceAgeBands", ageBands);

    const countries = parseTopLocations(influencer.audience_top_countries);
    if (countries.length) push("audience.countries", countries);

    const cities = parseTopLocations(influencer.audience_top_cities);
    if (cities.length) {
      push("audience.cities", cities);
      push("audience.audienceCities", cities);
    }
  }

  return candidates;
}

function mapAccountCandidates(
  account: BaselinePlatformAccountRow,
  mergedAt: string
): DnaFieldCandidate<unknown>[] {
  const candidates: DnaFieldCandidate<unknown>[] = [];
  const push = <T>(
    path: string,
    value: T,
    field: string,
    options?: { isVerified?: boolean }
  ) => {
    candidates.push(accountCandidate(path, value, field, account, mergedAt, options));
  };

  const handle =
    account.username?.trim()
      ? `@${account.username.replace(/^@/, "")}`
      : account.handle?.trim()
        ? account.handle.startsWith("@")
          ? account.handle
          : `@${account.handle}`
        : null;

  push("identity.handle", handle, "handle");
  push("identity.platform", canonicalPlatformKey(account.platform), "platform");
  push("identity.bio", account.profile_bio ?? null, "profile_bio");
  if (account.profile_picture_url && isDisplayableAvatarUrl(account.profile_picture_url)) {
    push("identity.avatarUrl", account.profile_picture_url, "profile_picture_url");
  }
  push("identity.isVerified", account.is_verified ?? null, "is_verified", {
    isVerified: account.is_verified ?? false,
  });

  push("content.profileUrl", account.profile_url ?? null, "profile_url");
  push("content.username", account.username ?? null, "username");
  if (Array.isArray(account.recent_publications) && account.recent_publications.length > 0) {
    push("content.recentPublications", account.recent_publications, "recent_publications");
  }

  push("metrics.followers", account.follower_count ?? null, "follower_count");
  push("metrics.following", account.following_count ?? null, "following_count");
  push("metrics.postsCount", account.posts_count ?? null, "posts_count");
  push("metrics.engagementRate", account.engagement_rate ?? null, "engagement_rate");
  push("metrics.avgLikes", account.avg_likes ?? null, "avg_likes");
  push("metrics.avgComments", account.avg_comments ?? null, "avg_comments");
  push("metrics.avgViews", account.avg_views ?? null, "avg_views");

  if (account.audience_country) {
    push("audience.country", account.audience_country, "audience_country");
    push("audience.countries", [account.audience_country], "audience_country");
  }

  if (account.interest_categories?.length) {
    push("audience.interests", account.interest_categories, "interest_categories");
    push("audience.categories", account.interest_categories, "interest_categories");
  }
  if (account.hashtags?.length) push("audience.hashtags", account.hashtags, "hashtags");
  if (account.mentions?.length) push("audience.mentions", account.mentions, "mentions");

  if (account.contact_email) push("contact.email", account.contact_email, "contact_email");
  if (account.contact_phone) push("contact.phone", account.contact_phone, "contact_phone");
  if (account.contact_links?.length) {
    push("contact.links", account.contact_links, "contact_links");
  }

  return candidates;
}

function mapPlatformAggregateCandidates(
  accounts: BaselinePlatformAccountRow[],
  defaultAccount: BaselinePlatformAccountRow | null,
  mergedAt: string
): DnaFieldCandidate<unknown>[] {
  const candidates: DnaFieldCandidate<unknown>[] = [];
  const push = <T>(path: string, value: T) => {
    candidates.push(candidate(path, value, "manual", mergedAt));
  };

  push("platforms.accountCount", accounts.length);
  if (defaultAccount) {
    push("platforms.primaryPlatform", canonicalPlatformKey(defaultAccount.platform));
  }

  const reach = accounts.reduce((sum, account) => sum + (account.follower_count ?? 0), 0);
  if (reach > 0) push("platforms.crossPlatformReach", reach);

  return candidates;
}

function mapAiCandidates(
  aiScore: BaselineAiScoreRow | null,
  mergedAt: string
): DnaFieldCandidate<unknown>[] {
  if (!aiScore) return [];
  const candidates: DnaFieldCandidate<unknown>[] = [];
  const push = <T>(path: string, value: T) => {
    candidates.push(candidate(path, value, "ai_infer", mergedAt));
  };

  if (aiScore.category) push("scores.aiCategory", aiScore.category);
  if (aiScore.niche) push("scores.aiNiche", aiScore.niche);
  if (aiScore.brand_fit_score != null) push("scores.brandFit", aiScore.brand_fit_score);
  if (aiScore.content_quality_score != null) {
    push("scores.authenticityScore", aiScore.content_quality_score);
  }

  return candidates;
}

function mapCampaignCandidates(
  campaignCount: number,
  brandCategories: string[],
  mergedAt: string
): DnaFieldCandidate<unknown>[] {
  const candidates: DnaFieldCandidate<unknown>[] = [];
  if (campaignCount > 0) {
    candidates.push(
      candidate(
        "historicalPerformance.campaignsCompleted",
        campaignCount,
        "campaign",
        mergedAt
      )
    );
  }
  if (brandCategories.length > 0) {
    candidates.push(
      candidate(
        "commercial.historicalBrandCategories",
        brandCategories,
        "campaign",
        mergedAt
      )
    );
  }
  return candidates;
}

/** Build baseline field candidates from operational tables + existing IPL snapshots. */
export function mapBaselineToFieldCandidates(input: BaselineMapperInput): DnaFieldCandidate<unknown>[] {
  const { influencer, accounts, mergedAt } = input;
  const defaultAccountId = resolveDefaultMetricsPlatformAccountId(
    accounts,
    influencer.default_metrics_platform_account_id
  );
  const defaultAccount =
    accounts.find((account) => account.id === defaultAccountId) ?? accounts[0] ?? null;

  const candidates: DnaFieldCandidate<unknown>[] = [
    ...mapInfluencerCandidates(influencer, mergedAt),
    ...mapPlatformAggregateCandidates(accounts, defaultAccount, mergedAt),
    ...mapAiCandidates(input.aiScore, mergedAt),
    ...mapCampaignCandidates(input.campaignCount, input.brandCategories, mergedAt),
  ];

  if (defaultAccount) {
    candidates.push(...mapAccountCandidates(defaultAccount, mergedAt));
  }

  for (const snapshot of input.snapshots) {
    candidates.push(
      ...mapSnapshotToFieldCandidates({
        snapshotId: snapshot.id,
        normalized: snapshot.normalized_snapshot,
        snapshotVersion: snapshot.snapshot_version,
        fetchedAt: snapshot.fetched_at,
        platformAccountId: snapshot.platform_account_id,
      })
    );
  }

  return candidates;
}
