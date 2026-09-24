import { resolveCountryCode } from "./normalization/validators";
import { normalizeRequirementLanguage } from "./normalization/normalize-campaign-intelligence";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";

import { getValidatedIntelligence } from "./get-validated-intelligence";
import {
  normalizedEntitiesFromDiscoveryRequirements,
  toValidatedCampaignIntelligence,
} from "./normalization";
import type { CampaignIntelligenceProfile } from "../types/profile";

/** Discovery-facing requirements — searchable fields only. */
export type DiscoveryCampaignRequirements = {
  creatorCountries?: string[];
  creatorLanguages?: string[];
  contentLanguages?: string[];
  creatorGender?: string;
  creatorTiers?: string[];
  engagementMin?: string;
  brandName: string;
  clientName: string;
  /** Primary market country code (ISO). */
  marketCountry: string;
  audienceLanguages?: string[];
  audienceCountries: string[];
  audienceGender: string;
  audienceAgeMin: string;
  audienceAgeMax: string;
  /** Short audience note (optional, max ~120 chars in UI). */
  audienceNote: string;
  platforms: string[];
  categories: string[];
  creatorNiches: string[];
  followerMin: string;
  followerMax: string;
  keywords: string[];
};

export const EMPTY_DISCOVERY_REQUIREMENTS: DiscoveryCampaignRequirements = {
  brandName: "",
  clientName: "",
  marketCountry: "",
  audienceCountries: [],
  audienceGender: "",
  audienceAgeMin: "",
  audienceAgeMax: "",
  audienceNote: "",
  platforms: [],
  categories: [],
  creatorNiches: [],
  followerMin: "",
  followerMax: "",
  keywords: [],
};

/** Read Discovery requirements from validatedIntelligence SSOT only. */
export function profileToDiscoveryRequirements(
  profile: CampaignIntelligenceProfile
): DiscoveryCampaignRequirements {
  const v = getValidatedIntelligence(profile);
  if (!v) {
    return EMPTY_DISCOVERY_REQUIREMENTS;
  }

  return {
    creatorCountries: [...(v.creator.countries ?? [])],
    creatorLanguages: [...(v.creator.languages ?? [])],
    contentLanguages: [...(v.creator.contentLanguages ?? [])],
    creatorGender: v.creator.gender ?? "",
    creatorTiers: [...(v.creator.tiers ?? [])],
    engagementMin: v.creator.engagementMin == null ? "" : String(v.creator.engagementMin),
    brandName: v.brand.brandName ?? "",
    clientName: v.brand.clientName ?? "",
    marketCountry: v.market.countryCode ?? "",
    audienceLanguages: [...v.audience.languages],
    audienceCountries: [...v.audience.countries],
    audienceGender: v.audience.gender === "any" ? "" : (v.audience.gender ?? ""),
    audienceAgeMin: v.audience.ageMin != null ? String(v.audience.ageMin) : "",
    audienceAgeMax: v.audience.ageMax != null ? String(v.audience.ageMax) : "",
    audienceNote: "",
    platforms: [...v.platforms],
    categories: [...v.categories],
    creatorNiches: [...v.creator.niches, ...v.creator.creatorTypes],
    followerMin: v.creator.followerMin != null ? String(v.creator.followerMin) : "",
    followerMax: v.creator.followerMax != null ? String(v.creator.followerMax) : "",
    keywords: [...v.keywords],
  };
}

function formatFollowerCategory(min: string, max: string): string | null {
  if (!min && !max) return null;
  const fmt = (n: string) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return n;
    if (num >= 1_000_000) return `${num / 1_000_000}M`;
    if (num >= 1_000) return `${Math.round(num / 1_000)}k`;
    return String(num);
  };
  if (min && max) return `${fmt(min)}-${fmt(max)} followers`;
  if (min) return `${fmt(min)}+ followers`;
  return `up to ${fmt(max)} followers`;
}

/** Validate operator input before applying the same existing normalized contract. */
export function validateDiscoveryRequirements(req: DiscoveryCampaignRequirements): string | null {
  for (const raw of [...(req.creatorCountries ?? []), ...req.audienceCountries, ...(req.marketCountry ? [req.marketCountry] : [])]) if (!resolveCountryCode(raw)) return `Unrecognized country: ${raw}`;
  for (const raw of [...(req.creatorLanguages ?? []), ...(req.contentLanguages ?? []), ...(req.audienceLanguages ?? [])]) if (!normalizeRequirementLanguage(raw)) return `Unrecognized language: ${raw}`;
  for (const raw of [req.followerMin, req.followerMax, req.engagementMin]) if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) return "Follower and engagement requirements must be positive numbers.";
  if (req.followerMin && req.followerMax && Number(req.followerMin) > Number(req.followerMax)) return "Minimum followers exceeds maximum followers.";
  if (Number(req.engagementMin) > 100) return "Engagement must not exceed 100%.";
  for (const tier of req.creatorTiers ?? []) if (!/^(nano|micro|mid|macro|mega|celebrity)$/i.test(tier)) return `Unrecognized tier: ${tier}`;
  if ([req.platforms, req.categories, req.keywords, req.creatorNiches].some(xs => xs.length > 30 || xs.some(x => x.length > 300))) return "Use at most 30 concise values per requirement.";
  return null;
}

/** Merge Discovery requirements into CIP — updates validatedIntelligence SSOT. */
export function discoveryRequirementsToProfile(
  base: CampaignIntelligenceProfile,
  req: DiscoveryCampaignRequirements
): CampaignIntelligenceProfile {
  const previous = profileToDiscoveryRequirements(base);
  const edited = (key: keyof DiscoveryCampaignRequirements) => JSON.stringify(previous[key] ?? "") !== JSON.stringify(req[key] ?? "");
  const operatorEvidence = { level: "extracted" as const, confidence: 1, sourceField: "operator", excerpt: "Edited campaign requirements" };
  const provenance = { ...base.fieldProvenance };
  for (const [field, key] of [
    ["creatorRequirements.countries", "creatorCountries"], ["creatorRequirements.languages", "creatorLanguages"], ["creatorRequirements.gender", "creatorGender"], ["creatorRequirements.tiers", "creatorTiers"], ["creatorRequirements.engagementMin", "engagementMin"], ["contentLanguages", "contentLanguages"], ["creatorCategories", "categories"], ["creatorNiches", "creatorNiches"], ["keywords", "keywords"], ["market", "marketCountry"], ["geography", "marketCountry"], ["audienceDetail.countries", "audienceCountries"], ["audienceDetail.languages", "audienceLanguages"], ["platforms", "platforms"]
  ] as const) if (edited(key)) provenance[field] = operatorEvidence;
  const followerLabel = formatFollowerCategory(req.followerMin, req.followerMax);
  const creatorCategories = [
    ...req.categories,
    ...(followerLabel ? [followerLabel] : []),
  ];

  const marketLabel =
    COUNTRY_OPTIONS.find((o) => o.value === req.marketCountry)?.label ?? req.marketCountry;

  const normalizedEntities = normalizedEntitiesFromDiscoveryRequirements(req);
  normalizedEntities.audience.languages = req.audienceLanguages?.map(v => normalizeRequirementLanguage(v)).filter((v): v is string => Boolean(v)) ?? base.validatedIntelligence?.audience.languages ?? [];
  normalizedEntities.audience.cities = base.validatedIntelligence?.audience.cities ?? [];
  normalizedEntities.creator = { ...base.validatedIntelligence?.creator, ...normalizedEntities.creator,
    countries: req.creatorCountries?.map(v => resolveCountryCode(v)).filter((v): v is string => Boolean(v)) ?? base.validatedIntelligence?.creator.countries,
    languages: req.creatorLanguages?.map(v => normalizeRequirementLanguage(v)).filter((v): v is string => Boolean(v)) ?? base.validatedIntelligence?.creator.languages,
    contentLanguages: req.contentLanguages?.map(v => normalizeRequirementLanguage(v)).filter((v): v is string => Boolean(v)) ?? base.validatedIntelligence?.creator.contentLanguages,
    gender: req.creatorGender === undefined ? base.validatedIntelligence?.creator.gender : req.creatorGender === "female" || req.creatorGender === "male" ? req.creatorGender : undefined,
    tiers: req.creatorTiers ?? base.validatedIntelligence?.creator.tiers,
    engagementMin: req.engagementMin === undefined ? base.validatedIntelligence?.creator.engagementMin : req.engagementMin ? Number(req.engagementMin) : undefined,
  };
  for (const [key, reqKey] of [["creator.countries", "creatorCountries"], ["creator.languages", "creatorLanguages"], ["creator.contentLanguages", "contentLanguages"], ["creator.gender", "creatorGender"], ["creator.tiers", "creatorTiers"], ["creator.engagementMin", "engagementMin"], ["keywords", "keywords"]] as const) {
    const evidence = edited(reqKey) ? operatorEvidence : base.validatedIntelligence?.fieldEvidence[key];
    if (evidence) normalizedEntities.fieldEvidence[key] = evidence;
  }
  const validatedIntelligence = toValidatedCampaignIntelligence(normalizedEntities);

  return {
    ...base,
    market: marketLabel || undefined,
    geography: marketLabel ? [marketLabel] : [],
    brandName: req.brandName,
    clientName: req.clientName,
    platforms: normalizedEntities.platforms,
    audienceDetail: { ...base.audienceDetail, countries: [...req.audienceCountries], languages: req.audienceLanguages ?? base.audienceDetail?.languages, gender: req.audienceGender || undefined, ageMin: req.audienceAgeMin ? Number(req.audienceAgeMin) : undefined, ageMax: req.audienceAgeMax ? Number(req.audienceAgeMax) : undefined },
    creatorRequirements: { countries: req.creatorCountries ?? base.creatorRequirements?.countries, languages: req.creatorLanguages ?? base.creatorRequirements?.languages, gender: req.creatorGender ?? base.creatorRequirements?.gender, tiers: req.creatorTiers ?? base.creatorRequirements?.tiers, engagementMin: req.engagementMin ? Number(req.engagementMin) : undefined },
    contentLanguages: req.contentLanguages ?? base.contentLanguages,
    keywords: [...req.keywords],
    fieldProvenance: provenance,
    validatedIntelligence,
    normalizedEntities,
    extractionIssues: base.extractionIssues ?? [],
    creatorCategories,
    creatorNiches: [...req.creatorNiches],
  };
}

/** Fields kept in Campaign Intelligence view, not Discovery requirements. */
export function getCampaignIntelligenceExtras(profile: CampaignIntelligenceProfile) {
  return {
    campaignName: profile.campaignName,
    campaignType: profile.campaignType,
    objectives: profile.objectives ?? [],
    deliverables: profile.deliverables ?? [],
    kpis: profile.kpis ?? [],
    budget: profile.budget,
    durationWeeks: profile.durationWeeks,
    products: profile.products ?? [],
    constraints: profile.constraints ?? [],
    risks: profile.risks ?? [],
    requirements: profile.requirements,
    toneOfVoice: profile.toneOfVoice ?? [],
    marketTier: profile.marketTier,
    brandSafetyLevel: profile.brandSafetyLevel,
    expectedCreatorCount: profile.expectedCreatorCount,
    extractionIssues: profile.extractionIssues ?? [],
  };
}

export function hasCampaignIntelligenceExtras(
  profile: CampaignIntelligenceProfile
): boolean {
  const extras = getCampaignIntelligenceExtras(profile);
  return Boolean(
    extras.campaignName ||
      extras.campaignType ||
      extras.objectives.length ||
      extras.deliverables.length ||
      extras.kpis.length ||
      extras.budget?.amount ||
      extras.durationWeeks ||
      extras.products.length ||
      extras.constraints.length ||
      extras.risks.length ||
      extras.extractionIssues.length
  );
}
