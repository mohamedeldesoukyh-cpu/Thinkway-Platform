import type { DiscoveryPlatform } from "@/lib/discovery/types";

import type {
  BrandSafetyLevel,
  FieldProvenance,
  NormalizedAudienceEntities,
  NormalizedBrandEntities,
  NormalizedCreatorEntities,
  NormalizedMarketEntities,
} from "../services/normalization/types";

/**
 * Single source of truth for Discovery, Studio, and Director after validation.
 * Populated by: Upload → Extract → Normalize → Validate → Persist.
 * UI and Discovery MUST read only this object — never raw extraction fields.
 */
export type ValidatedCampaignIntelligence = {
  brand: NormalizedBrandEntities;
  market: NormalizedMarketEntities;
  audience: NormalizedAudienceEntities;
  creator: NormalizedCreatorEntities;
  platforms: DiscoveryPlatform[];
  categories: string[];
  keywords: string[];
  brandSafety: BrandSafetyLevel;
  /** Per-field evidence for review UI — inferred values are stripped before persist. */
  fieldEvidence: Record<string, FieldProvenance>;
  validatedAt: string;
};

export function createEmptyValidatedIntelligence(): ValidatedCampaignIntelligence {
  return {
    brand: {},
    market: { cities: [] },
    audience: { countries: [], cities: [], languages: [] },
    creator: { niches: [], creatorTypes: [] },
    platforms: [],
    categories: [],
    keywords: [],
    brandSafety: "none",
    fieldEvidence: {},
    validatedAt: new Date().toISOString(),
  };
}

/** Build validated intelligence from normalized entities post-validation. */
export function toValidatedCampaignIntelligence(
  entities: Omit<ValidatedCampaignIntelligence, "validatedAt">,
  validatedAt = new Date().toISOString()
): ValidatedCampaignIntelligence {
  return {
    brand: { ...entities.brand },
    market: { ...entities.market, cities: [...entities.market.cities] },
    audience: {
      ...entities.audience,
      countries: [...entities.audience.countries],
      cities: [...entities.audience.cities],
      languages: [...entities.audience.languages],
    },
    creator: {
      ...entities.creator,
      niches: [...entities.creator.niches],
      creatorTypes: [...entities.creator.creatorTypes],
    },
    platforms: [...entities.platforms],
    categories: [...entities.categories],
    keywords: [...entities.keywords],
    brandSafety: entities.brandSafety,
    fieldEvidence: { ...entities.fieldEvidence },
    validatedAt,
  };
}

/** Migrate legacy normalizedEntities to validatedIntelligence shape. */
export function validatedFromNormalizedEntities(
  entities: Omit<ValidatedCampaignIntelligence, "validatedAt">,
  validatedAt?: string
): ValidatedCampaignIntelligence {
  return toValidatedCampaignIntelligence(entities, validatedAt ?? new Date().toISOString());
}
