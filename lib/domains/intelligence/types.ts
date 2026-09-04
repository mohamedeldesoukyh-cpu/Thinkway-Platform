import type {
  CampaignIntelligenceProfile,
  CampaignIntelligenceStatus,
} from "@/features/campaign-intelligence-profile/types/profile";

/** Platform-wide Campaign Intelligence Object status workflow. */
export type CampaignIntelligenceObjectStatus =
  CampaignIntelligenceStatus | "archived";

export type CampaignIntelligenceLibraryFilters = {
  brandId?: string | null;
  clientId?: string | null;
  campaignHeaderId?: string | null;
  status?: CampaignIntelligenceObjectStatus | "all" | null;
  search?: string | null;
};

export type CampaignIntelligenceLibraryItem = {
  id: string;
  title: string;
  status: CampaignIntelligenceObjectStatus;
  brandId: string | null;
  brandName: string | null;
  clientId: string | null;
  clientName: string | null;
  campaignHeaderId: string | null;
  campaignName: string | null;
  campaignDocumentNumber: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type CampaignIntelligenceObjectRow = {
  id: string;
  created_by: string;
  updated_by: string | null;
  conversation_id: string | null;
  brand_id: string | null;
  campaign_header_id: string | null;
  status: CampaignIntelligenceObjectStatus;
  profile: CampaignIntelligenceProfile;
  source_document_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandMatchCandidate = {
  brandId: string;
  brandName: string;
  clientId: string;
  clientName: string;
  confidence: number;
};

export type CampaignIntelligenceUploadIntent = {
  mode: "create" | "link";
  brandId: string;
  campaignHeaderId?: string | null;
  linkProfileId?: string | null;
};
