import type { DiscoveryPlatform } from "@/lib/discovery/types";

export type NormalizedGender = "female" | "male" | "any";

export type BrandSafetyLevel = "required" | "preferred" | "none";

/** How a normalized field was derived. */
export type EvidenceLevel = "extracted" | "normalized" | "inferred";

export type FieldProvenance = {
  level: EvidenceLevel;
  confidence: number;
  sourceField?: string;
};

export type NormalizedBrandEntities = {
  brandName?: string;
  clientName?: string;
};

export type NormalizedMarketEntities = {
  countryCode?: string;
  countryLabel?: string;
  cities: string[];
};

export type NormalizedAudienceEntities = {
  countries: string[];
  cities: string[];
  gender?: NormalizedGender;
  ageMin?: number;
  ageMax?: number;
  languages: string[];
};

export type NormalizedCreatorEntities = {
  niches: string[];
  creatorTypes: string[];
  followerMin?: number;
  followerMax?: number;
  engagementMin?: number;
  engagementMax?: number;
};

export type NormalizedCampaignEntities = {
  brand: NormalizedBrandEntities;
  market: NormalizedMarketEntities;
  audience: NormalizedAudienceEntities;
  creator: NormalizedCreatorEntities;
  platforms: DiscoveryPlatform[];
  categories: string[];
  keywords: string[];
  brandSafety: BrandSafetyLevel;
  /** Per-field evidence for Discovery strict fields and review UI. */
  fieldEvidence: Record<string, FieldProvenance>;
};

export type ExtractionIssueSeverity = "error" | "warning";

export type ExtractionIssueKind =
  | "malformed"
  | "inferred_rejected"
  | "confirmation_required"
  | "geographic_expansion";

export type ExtractionIssue = {
  field: string;
  rawValue: string;
  reason: string;
  severity: ExtractionIssueSeverity;
  kind?: ExtractionIssueKind;
};

export function createEmptyNormalizedEntities(): NormalizedCampaignEntities {
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
  };
}
