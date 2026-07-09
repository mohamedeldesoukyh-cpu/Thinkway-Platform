import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";

import type { CampaignIntelligenceProfile } from "../../types/profile";
import { getValidatedIntelligence } from "../get-validated-intelligence";
import type { ValidatedCampaignIntelligence } from "../../types/validated-intelligence";
import { countryLabel, normalizeGender, normalizePlatform } from "../normalization/validators";
import { enrichBriefSearchSignals } from "./enrich-brief-search-signals";
import type {
  DiscoveryMappedFilter,
  DiscoverySearchFilterKey,
  DiscoverySearchMappingResult,
} from "./types";

const MIN_CONFIDENCE = 0.55;

function newFilterId(): string {
  return globalThis.crypto.randomUUID();
}

function pushFilter(
  filters: DiscoveryMappedFilter[],
  input: {
    key: DiscoverySearchFilterKey;
    label: string;
    value: string;
    confidence: number;
    weight?: number;
  }
): void {
  const value = input.value.trim();
  if (!value || input.confidence < MIN_CONFIDENCE) return;

  const duplicate = filters.some(
    (f) => f.key === input.key && f.value.toLowerCase() === value.toLowerCase()
  );
  if (duplicate) return;

  filters.push({
    id: newFilterId(),
    key: input.key,
    label: input.label,
    value,
    weight: input.weight ?? Math.round(input.confidence * 100),
    confidence: input.confidence,
  });
}

function fieldConfidence(
  profile: CampaignIntelligenceProfile,
  field: keyof CampaignIntelligenceProfile["confidence"] & string,
  fallback = 0.65
): number {
  const fromProfile = profile.confidence?.[field as keyof typeof profile.confidence];
  if (typeof fromProfile === "number") return fromProfile;
  const source = profile.sources?.[field as keyof typeof profile.sources];
  if (source === "brief") return 0.8;
  if (source === "inferred") return 0.6;
  return fallback;
}

function mapFromValidatedIntelligence(
  v: ValidatedCampaignIntelligence
): DiscoverySearchMappingResult {
  const filters: DiscoveryMappedFilter[] = [];
  const skipped: string[] = [];

  for (const platform of v.platforms) {
    pushFilter(filters, {
      key: "platform",
      label: "Social Platform",
      value: platform,
      confidence: v.fieldEvidence["platforms"]?.confidence ?? 0.9,
      weight: 100,
    });
  }

  const countryCodes = [
    ...new Set([v.market.countryCode, ...v.audience.countries].filter(Boolean) as string[]),
  ];
  for (const code of countryCodes) {
    pushFilter(filters, {
      key: "audience_country",
      label: "Audience Country",
      value: code,
      confidence: v.fieldEvidence["audience.countries"]?.confidence ?? 0.85,
      weight: 100,
    });
    pushFilter(filters, {
      key: "creator_country",
      label: "Creator Country",
      value: code,
      confidence: v.fieldEvidence["market.countryCode"]?.confidence ?? 0.8,
      weight: 90,
    });
  }

  for (const city of [...v.market.cities, ...v.audience.cities]) {
    if (!city.trim()) continue;
    pushFilter(filters, {
      key: "audience_city",
      label: "Audience City",
      value: city.trim(),
      confidence: 0.75,
      weight: 85,
    });
  }

  if (v.audience.gender && v.audience.gender !== "any") {
    pushFilter(filters, {
      key: "audience_gender",
      label: "Audience Gender",
      value: v.audience.gender,
      confidence: v.fieldEvidence["audience.gender"]?.confidence ?? 0.85,
      weight: 95,
    });
  }

  if (v.audience.ageMin != null && v.audience.ageMin >= 13) {
    pushFilter(filters, {
      key: "audience_age_min",
      label: "Audience Age Min",
      value: String(v.audience.ageMin),
      confidence: v.fieldEvidence["audience.ageMin"]?.confidence ?? 0.85,
      weight: 90,
    });
  }
  if (v.audience.ageMax != null && v.audience.ageMax <= 80) {
    pushFilter(filters, {
      key: "audience_age_max",
      label: "Audience Age Max",
      value: String(v.audience.ageMax),
      confidence: v.fieldEvidence["audience.ageMax"]?.confidence ?? 0.85,
      weight: 90,
    });
  }

  if (v.audience.ageMin != null && v.audience.ageMax != null) {
    pushFilter(filters, {
      key: "creator_age_min",
      label: "Creator Age Min",
      value: String(v.audience.ageMin),
      confidence: 0.68,
      weight: 75,
    });
    pushFilter(filters, {
      key: "creator_age_max",
      label: "Creator Age Max",
      value: String(v.audience.ageMax),
      confidence: 0.68,
      weight: 75,
    });
  }

  for (const language of v.audience.languages) {
    if (!language.trim()) continue;
    pushFilter(filters, {
      key: "language",
      label: "Language",
      value: language.trim(),
      confidence: v.fieldEvidence["audience.languages"]?.confidence ?? 0.78,
      weight: 80,
    });
  }

  for (const category of v.categories) {
    pushFilter(filters, {
      key: "category",
      label: "Category",
      value: category,
      confidence: 0.85,
      weight: 100,
    });
  }

  for (const niche of v.creator.niches) {
    pushFilter(filters, {
      key: "niche",
      label: "Niche",
      value: niche,
      confidence: 0.8,
      weight: 90,
    });
  }

  if (v.creator.followerMin != null) {
    pushFilter(filters, {
      key: "follower_min",
      label: "Follower Min",
      value: String(v.creator.followerMin),
      confidence: v.fieldEvidence["creator.followerMin"]?.confidence ?? 0.75,
      weight: 85,
    });
  }
  if (v.creator.followerMax != null) {
    pushFilter(filters, {
      key: "follower_max",
      label: "Follower Max",
      value: String(v.creator.followerMax),
      confidence: v.fieldEvidence["creator.followerMax"]?.confidence ?? 0.75,
      weight: 85,
    });
  }

  if (v.creator.engagementMin != null) {
    pushFilter(filters, {
      key: "engagement_min",
      label: "Engagement Min",
      value: String(v.creator.engagementMin),
      confidence: 0.72,
      weight: 75,
    });
  }

  for (const keyword of v.keywords) {
    pushFilter(filters, {
      key: "content_keyword",
      label: "Keyword",
      value: keyword,
      confidence: 0.7,
      weight: 70,
    });
  }

  if (v.brandSafety === "required") {
    pushFilter(filters, {
      key: "brand_safety_min",
      label: "Brand Safety",
      value: "70",
      confidence: 0.88,
      weight: 90,
    });
  }

  return { filters, skipped };
}

/** @deprecated Legacy mapper — only used in tests. */
function mapFromNormalizedEntities(
  profile: CampaignIntelligenceProfile,
  n: ValidatedCampaignIntelligence
): DiscoverySearchMappingResult {
  void profile;
  return mapFromValidatedIntelligence(n);
}

function resolveCountryCodeLegacy(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();

  const paren = trimmed.match(/\(([A-Za-z]{2})\)\s*$/);
  if (paren) return paren[1].toUpperCase();

  const exact = COUNTRY_OPTIONS.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact.value;

  const partial = COUNTRY_OPTIONS.find(
    (o) =>
      o.label.toLowerCase().includes(trimmed.toLowerCase()) ||
      trimmed.toLowerCase().includes(o.label.toLowerCase())
  );
  return partial?.value ?? null;
}

function parseFollowerToken(token: string): number | null {
  const cleaned = token.replace(/,/g, "").trim().toLowerCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  if (match[2] === "k") return Math.round(base * 1_000);
  if (match[2] === "m") return Math.round(base * 1_000_000);
  return Math.round(base);
}

function parseFollowerRange(text: string): { min?: number; max?: number } | null {
  const match = text.match(
    /(\d[\d,.\s]*)\s*([kKmM])?\s*(?:-|–|—|to)\s*(\d[\d,.\s]*)\s*([kKmM])?/
  );
  if (!match) return null;
  const min = parseFollowerToken(`${match[1]}${match[2] ?? ""}`);
  const max = parseFollowerToken(`${match[3]}${match[4] ?? ""}`);
  if (min == null && max == null) return null;
  return { min: min ?? undefined, max: max ?? undefined };
}

function collectFollowerRangeHints(profile: CampaignIntelligenceProfile): string {
  return [
    ...(profile.creatorCategories ?? []),
    ...(profile.creatorNiches ?? []),
    profile.audience ?? "",
    ...(profile.requirements?.preferred ?? []),
    ...(profile.requirements?.mandatory ?? []),
  ].join(" ");
}

function mapFromLegacyProfile(profile: CampaignIntelligenceProfile): DiscoverySearchMappingResult {
  const filters: DiscoveryMappedFilter[] = [];
  const skipped: string[] = [];

  for (const platform of profile.platforms ?? []) {
    const normalized = normalizePlatform(platform);
    if (!normalized) {
      skipped.push(`platform:${platform}`);
      continue;
    }
    pushFilter(filters, {
      key: "platform",
      label: "Social Platform",
      value: normalized,
      confidence: fieldConfidence(profile, "platforms", 0.85),
      weight: 100,
    });
  }

  const audienceCountries = [
    ...(profile.audienceDetail?.countries ?? []),
    ...(profile.geography ?? []),
    ...(profile.market ? [profile.market] : []),
  ];
  for (const raw of audienceCountries) {
    const code = resolveCountryCodeLegacy(raw);
    if (!code) {
      skipped.push(`audience_country:${raw}`);
      continue;
    }
    pushFilter(filters, {
      key: "audience_country",
      label: "Audience Country",
      value: code,
      confidence: fieldConfidence(profile, "geography", 0.78),
      weight: 100,
    });
    pushFilter(filters, {
      key: "creator_country",
      label: "Creator Country",
      value: code,
      confidence: fieldConfidence(profile, "geography", 0.72),
      weight: 90,
    });
  }

  for (const city of profile.audienceDetail?.cities ?? []) {
    if (!city.trim()) continue;
    pushFilter(filters, {
      key: "audience_city",
      label: "Audience City",
      value: city.trim(),
      confidence: 0.7,
      weight: 85,
    });
  }

  if (profile.audienceDetail?.gender) {
    const gender = normalizeGender(profile.audienceDetail.gender);
    if (gender && gender !== "any") {
      pushFilter(filters, {
        key: "audience_gender",
        label: "Audience Gender",
        value: gender,
        confidence: fieldConfidence(profile, "audience", 0.82),
        weight: 95,
      });
    } else {
      skipped.push(`audience_gender:${profile.audienceDetail.gender}`);
    }
  }

  if (profile.audienceDetail?.ageMin != null && profile.audienceDetail.ageMin >= 13) {
    pushFilter(filters, {
      key: "audience_age_min",
      label: "Audience Age Min",
      value: String(profile.audienceDetail.ageMin),
      confidence: 0.8,
      weight: 90,
    });
  }
  if (profile.audienceDetail?.ageMax != null && profile.audienceDetail.ageMax <= 80) {
    pushFilter(filters, {
      key: "audience_age_max",
      label: "Audience Age Max",
      value: String(profile.audienceDetail.ageMax),
      confidence: 0.8,
      weight: 90,
    });
  }

  if (profile.audienceDetail?.ageMin != null && profile.audienceDetail?.ageMax != null) {
    pushFilter(filters, {
      key: "creator_age_min",
      label: "Creator Age Min",
      value: String(profile.audienceDetail.ageMin),
      confidence: 0.65,
      weight: 75,
    });
    pushFilter(filters, {
      key: "creator_age_max",
      label: "Creator Age Max",
      value: String(profile.audienceDetail.ageMax),
      confidence: 0.65,
      weight: 75,
    });
  }

  for (const language of profile.audienceDetail?.languages ?? []) {
    if (!language.trim()) continue;
    pushFilter(filters, {
      key: "language",
      label: "Language",
      value: language.trim(),
      confidence: 0.75,
      weight: 80,
    });
  }

  for (const category of profile.creatorCategories ?? []) {
    const value = category.trim();
    if (!value || value.length < 2) continue;
    if (parseFollowerRange(value)) continue;
    pushFilter(filters, {
      key: "category",
      label: "Category",
      value,
      confidence: 0.72,
      weight: 100,
    });
  }

  for (const niche of profile.creatorNiches ?? []) {
    const value = niche.trim();
    if (!value || value.length < 2) continue;
    pushFilter(filters, {
      key: "niche",
      label: "Niche",
      value,
      confidence: 0.7,
      weight: 90,
    });
  }

  const followerRange = parseFollowerRange(collectFollowerRangeHints(profile));
  if (followerRange?.min != null) {
    pushFilter(filters, {
      key: "follower_min",
      label: "Follower Min",
      value: String(followerRange.min),
      confidence: 0.68,
      weight: 85,
    });
  }
  if (followerRange?.max != null) {
    pushFilter(filters, {
      key: "follower_max",
      label: "Follower Max",
      value: String(followerRange.max),
      confidence: 0.68,
      weight: 85,
    });
  }

  if (profile.brandSafetyLevel === "required") {
    pushFilter(filters, {
      key: "brand_safety_min",
      label: "Brand Safety",
      value: "70",
      confidence: 0.88,
      weight: 90,
    });
  }

  if (profile.marketTier === "luxury" || profile.marketTier === "premium") {
    pushFilter(filters, {
      key: "brand_fit_min",
      label: "Brand Fit",
      value: "70",
      confidence: 0.75,
      weight: 80,
    });
  }

  const engagementKpi = (profile.kpis ?? []).find((k) => /engagement|er\b/i.test(k));
  if (engagementKpi) {
    const pct = engagementKpi.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pct) {
      pushFilter(filters, {
        key: "engagement_min",
        label: "Engagement Min",
        value: pct[1],
        confidence: 0.7,
        weight: 75,
      });
    }
  }

  for (const tag of profile.contentStyle ?? []) {
    const value = tag.trim().toLowerCase();
    if (!value) continue;
    pushFilter(filters, {
      key: "content_tag",
      label: "Content Tag",
      value: tag.trim(),
      confidence: 0.62,
      weight: 70,
    });
  }

  if ((profile.requirements?.mandatory ?? []).some((r) => /verified/i.test(r))) {
    pushFilter(filters, {
      key: "verified",
      label: "Verified",
      value: "true",
      confidence: 0.85,
      weight: 80,
    });
  }

  return { filters, skipped };
}

/**
 * Maps Campaign Intelligence → Discovery-supported filters only.
 * Reads validatedIntelligence SSOT — strict allowlist, no legacy raw fallbacks.
 */
export function mapCampaignIntelligenceToDiscoverySearch(
  profile: CampaignIntelligenceProfile
): DiscoverySearchMappingResult {
  const validated = getValidatedIntelligence(profile);
  if (!validated) {
    return { filters: [], skipped: ["no_validated_intelligence"] };
  }

  const result = mapFromValidatedIntelligence(validated);
  for (const issue of profile.extractionIssues ?? []) {
    result.skipped.push(`${issue.field}:${issue.rawValue}`);
  }
  return enrichBriefSearchSignals(profile, result);
}

/** Display value for chips (e.g. country code → label). */
export function formatDiscoveryMappedFilterValue(filter: DiscoveryMappedFilter): string {
  if (filter.key === "audience_country" || filter.key === "creator_country") {
    return countryLabel(filter.value);
  }
  if (filter.key === "platform") {
    return filter.value.charAt(0).toUpperCase() + filter.value.slice(1);
  }
  if (filter.key === "audience_gender" || filter.key === "creator_gender") {
    return filter.value.charAt(0).toUpperCase() + filter.value.slice(1);
  }
  return filter.value;
}
