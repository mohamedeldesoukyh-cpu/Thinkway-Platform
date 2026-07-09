import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";

import { getValidatedIntelligence } from "./get-validated-intelligence";
import {
  normalizedEntitiesFromDiscoveryRequirements,
  toValidatedCampaignIntelligence,
} from "./normalization";
import type { CampaignIntelligenceProfile } from "../types/profile";

/** Discovery-facing requirements — searchable fields only. */
export type DiscoveryCampaignRequirements = {
  brandName: string;
  clientName: string;
  /** Primary market country code (ISO). */
  marketCountry: string;
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
    brandName: v.brand.brandName ?? "",
    clientName: v.brand.clientName ?? "",
    marketCountry: v.market.countryCode ?? "",
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

/** Merge Discovery requirements into CIP — updates validatedIntelligence SSOT. */
export function discoveryRequirementsToProfile(
  base: CampaignIntelligenceProfile,
  req: DiscoveryCampaignRequirements
): CampaignIntelligenceProfile {
  const followerLabel = formatFollowerCategory(req.followerMin, req.followerMax);
  const creatorCategories = [
    ...req.categories,
    ...(followerLabel ? [followerLabel] : []),
  ];

  const marketLabel =
    COUNTRY_OPTIONS.find((o) => o.value === req.marketCountry)?.label ?? req.marketCountry;

  const normalizedEntities = normalizedEntitiesFromDiscoveryRequirements(req);
  const validatedIntelligence = toValidatedCampaignIntelligence(normalizedEntities);

  return {
    ...base,
    market: marketLabel || base.market,
    validatedIntelligence,
    normalizedEntities,
    extractionIssues: base.extractionIssues ?? [],
    creatorCategories: creatorCategories.length ? creatorCategories : base.creatorCategories,
    creatorNiches: [...new Set([...req.creatorNiches, ...req.keywords])],
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
