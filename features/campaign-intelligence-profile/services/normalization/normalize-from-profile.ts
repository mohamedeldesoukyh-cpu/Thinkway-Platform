import type { CampaignIntelligenceProfile } from "../../types/profile";
import { toValidatedCampaignIntelligence } from "../../types/validated-intelligence";

import { buildFieldProvenanceFromProfile } from "./field-provenance";
import { normalizeCampaignIntelligence } from "./normalize-campaign-intelligence";
import {
  stripInferredStrictFacts,
  validateNormalizedEvidence,
} from "./validate-normalized-evidence";
import type { ExtractionIssue, NormalizedCampaignEntities } from "./types";
import { isValidBrandName, sanitizeBrandName } from "./validators";

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

  return {
    profile: {
      ...sanitized,
      brandName: cleanedBrandName,
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
