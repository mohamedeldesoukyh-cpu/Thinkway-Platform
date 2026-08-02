import type { CampaignIntelligenceProfile } from "../../types/profile";
import { toValidatedCampaignIntelligence } from "../../types/validated-intelligence";

import { buildFieldProvenanceFromProfile } from "./field-provenance";
import { normalizeCampaignIntelligence } from "./normalize-campaign-intelligence";
import {
  stripInferredStrictFacts,
  validateNormalizedEvidence,
} from "./validate-normalized-evidence";
import type { ExtractionIssue, NormalizedCampaignEntities } from "./types";
import {
  countryLabel,
  isValidBrandName,
  resolveCountryCode,
  sanitizeBrandName,
} from "./validators";

export type NormalizeFromProfileResult = {
  profile: CampaignIntelligenceProfile;
  validatedIntelligence: ReturnType<typeof toValidatedCampaignIntelligence>;
  extractionIssues: ExtractionIssue[];
  /** @deprecated Use validatedIntelligence */
  normalizedEntities: NormalizedCampaignEntities;
};

/**
 * Run normalization + evidence validation on a freshly extracted (or legacy) CIP.
 * Inferred strict fields are stripped; confirmation issues are surfaced.
 */
export function normalizeFromProfile(
  profile: CampaignIntelligenceProfile
): NormalizeFromProfileResult {
  const withProvenance: CampaignIntelligenceProfile = {
    ...profile,
    fieldProvenance: buildFieldProvenanceFromProfile(profile),
  };

  const { normalizedEntities, extractionIssues } = normalizeCampaignIntelligence(withProvenance);
  const validated = validateNormalizedEvidence(
    withProvenance,
    normalizedEntities,
    extractionIssues
  );

  const validatedIntelligence = toValidatedCampaignIntelligence(validated.normalizedEntities);
  const sanitized = stripInferredStrictFacts(withProvenance);

  const profileBrand = sanitized.brandName?.trim();
  const cleanedBrandName =
    profileBrand && isValidBrandName(sanitizeBrandName(profileBrand))
      ? sanitizeBrandName(profileBrand)
      : undefined;

  const marketCode = sanitized.market ? resolveCountryCode(sanitized.market) : null;
  const cleanedMarket = marketCode ? countryLabel(marketCode) : undefined;
  const cleanedGeography = (sanitized.geography ?? [])
    .map((value) => {
      const code = resolveCountryCode(value);
      return code ? countryLabel(code) : null;
    })
    .filter((value): value is string => Boolean(value));
  const uniqueGeography = [...new Set(cleanedGeography)];

  return {
    profile: {
      ...sanitized,
      brandName: cleanedBrandName,
      market: cleanedMarket,
      geography: uniqueGeography.length > 0 ? uniqueGeography : undefined,
      audienceDetail: sanitized.audienceDetail
        ? {
            ...sanitized.audienceDetail,
            countries: (sanitized.audienceDetail.countries ?? [])
              .map((value) => {
                const code = resolveCountryCode(value);
                return code ? countryLabel(code) : null;
              })
              .filter((value): value is string => Boolean(value)),
          }
        : undefined,
      validatedIntelligence,
      normalizedEntities: validated.normalizedEntities,
      extractionIssues: validated.extractionIssues,
      fieldProvenance: withProvenance.fieldProvenance,
    },
    validatedIntelligence,
    normalizedEntities: validated.normalizedEntities,
    extractionIssues: validated.extractionIssues,
  };
}
