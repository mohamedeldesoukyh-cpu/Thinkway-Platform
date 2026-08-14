import type { CampaignPerformanceBundle } from "@/lib/domains/campaign/types";

export type PerformanceReportVariant = "combined" | "influencers";

export type PerformanceReportCampaignMeta = {
  id: string;
  documentNumber: string;
  name: string;
  description: string | null;
  brief: string | null;
  startDate: string | null;
  endDate: string | null;
  objectives: string | null;
  country: string | null;
  clientName: string;
  brandName: string | null;
  brandLogoUrl: string | null;
  coverImageUrl: string | null;
  currency: string;
  dashboardUrl: string;
};

export type CampaignHighlights = {
  topCreatorName: string | null;
  topCreatorEngagements: number;
  bestPostLabel: string | null;
  bestPostViews: number;
  highestErLabel: string | null;
  highestEr: number | null;
  totalEngagements: number;
  platforms: string[];
};

export type PlatformBenchmark = {
  platform: string;
  label: string;
  averageEr: number | null;
  publicationCount: number;
};

export type InfluencerAudienceSnapshot = {
  genderSplit: Record<string, number> | null;
  topLocation: string | null;
  followerCount: number | null;
};

export type InfluencerReportSection = {
  influencerId: string;
  name: string;
  avatarUrl: string | null;
  platformHandles: string[];
  followerCount: number | null;
  role: string | null;
  audience: InfluencerAudienceSnapshot;
  insights: string[];
  summary: {
    publications: number;
    agreedPublications: number;
    addedValuePublications: number;
    views: number;
    reach: number;
    impressions: number;
    actualImpressions: number;
    forecastImpressions: number;
    engagements: number;
    averageEr: number | null;
  };
  publications: CampaignPerformanceBundle["publications"];
};

export type PerformanceReportDocumentData = {
  campaign: PerformanceReportCampaignMeta;
  bundle: CampaignPerformanceBundle;
  generatedAt: Date;
  variant: PerformanceReportVariant;
  influencerSections: InfluencerReportSection[];
  uniqueCreatorCount: number;
  highlights: CampaignHighlights;
  platformBenchmarks: PlatformBenchmark[];
  recommendations: string[];
  bestCreatorEr: number | null;
  bestCreatorErName: string | null;
};
