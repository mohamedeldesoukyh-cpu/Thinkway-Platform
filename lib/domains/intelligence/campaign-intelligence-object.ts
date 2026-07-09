/**
 * Campaign Intelligence Object — platform-wide SSOT for brief understanding.
 * Discovery, Studio, Campaign Director, AI Workflows, and Reports consume this object.
 */

export type {
  BrandMatchCandidate,
  CampaignIntelligenceLibraryFilters,
  CampaignIntelligenceLibraryItem,
  CampaignIntelligenceObjectRow,
  CampaignIntelligenceObjectStatus,
  CampaignIntelligenceUploadIntent,
} from "./types";

export {
  getCampaignIntelligenceForHeader,
  getCampaignIntelligenceObjectById,
  linkCampaignIntelligenceToCampaign,
  listCampaignIntelligenceForBrand,
  listCampaignIntelligenceLibrary,
} from "./repository";

/** Whether the user may read intelligence for a brand workspace context. */
export function canReadCampaignIntelligenceForBrand(hasDiscoveryRead: boolean): boolean {
  return hasDiscoveryRead;
}

/** Brand is required on every new Campaign Intelligence Object. */
export function assertBrandRequired(brandId: string | null | undefined): asserts brandId is string {
  if (!brandId?.trim()) {
    throw new Error("Campaign Intelligence requires a brand.");
  }
}
