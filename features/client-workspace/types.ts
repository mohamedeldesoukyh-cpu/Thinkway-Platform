import type { StudioPackageSourceState } from "@/features/campaign-studio/services/studio-package-readiness";

import type {
  ClientChangeArea,
  ClientCommentTargetType,
  ClientCreatorSelectionState,
  ClientReviewSource,
  ClientReviewStatus,
  ClientWorkspaceSectionId,
} from "./constants";

export type ClientDeliverableItem = {
  platform?: string;
  type: string;
  quantity?: number;
};

export type ClientContentPost = {
  url?: string | null;
  thumbnail?: string | null;
  platform?: string;
  postedAt?: string | null;
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
  engagementRate?: number | null;
};

export type ClientAudienceSlice = {
  label: string;
  percent?: number;
};

export type ClientAudienceBrief = {
  frozenAt: string;
  ages: ClientAudienceSlice[];
  genders: ClientAudienceSlice[];
  locations: ClientAudienceSlice[];
  interests: string[];
    summary?: string;
  qualityLabel?: string;
  qualityIndicators?: string[];
  growthPercent?: number;
  followerGrowth?: number;
  growthTrend?: string;
};

export type ClientHistoricalMonth = {
  periodMonth: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  engagementRate?: number;
  avgViews?: number;
  monthlyGrowthRate?: number;
};

export type ClientPerformanceBrief = {
  frozenAt: string;
  avgLikes?: number;
  avgComments?: number;
  avgViews?: number;
  engagementRate?: number;
  estimatedReach?: number;
  likesExplanation?: string;
  commentsExplanation?: string;
  viewsExplanation?: string;
  engagementExplanation?: string;
  reachExplanation?: string;
};

export type ClientMediaPlanSummary = {
  creatorCount: number;
  estimatedReach?: number;
  estimatedEngagements?: number;
  estimatedImpressions?: number;
  averageEngagementRate?: number;
  cpe?: number;
  cpm?: number;
  emv?: number;
  activityMix: Array<{ label: string; count: number }>;
  currency: string;
  creatorForecasts: Record<
    string,
    { estimatedReach?: number; estimatedEngagements?: number; cpe?: number; cpm?: number }
  >;
};

export type ClientReviewSourceSnapshotCreator = {
  creatorId: string;
  displayName: string;
  handle?: string;
  platform?: string;
  followers?: number;
  engagementRate?: number;
  country?: string;
  city?: string;
  category?: string;
  niche?: string;
  categories?: string[];
  audienceHighlight?: string;
  fitExplanation?: string;
  deliverables?: string;
  deliverableItems?: ClientDeliverableItem[];
  investmentAmount?: number;
  investmentCurrency?: string;
  avatarUrl?: string;
  profileUrl?: string;
  bio?: string;
  notes?: string;
  avgLikes?: number;
  avgComments?: number;
  avgViews?: number;
  estimatedReach?: number;
  estimatedEngagements?: number;
  cpe?: number;
  matchPercent?: number;
  matchConfidence?: number;
  matchExplanation?: string;
  matchEvidence?: string[];
  tier?: string;
  brandMentions?: string[];
  contentFeed?: ClientContentPost[];
  audience?: ClientAudienceBrief;
  performance?: ClientPerformanceBrief;
  historical?: ClientHistoricalMonth[];
  influencerId?: string;
  briefFrozenAt?: string;
  briefBackfillDone?: boolean;
};

export type ClientReviewSourceSnapshot = {
  source: ClientReviewSource;
  brandName: string;
  campaignName: string;
  clientLabel: string;
  objective?: string;
  audience?: string;
  market?: string;
  durationLabel?: string;
  platforms: string[];
  deliverables: string[];
  whyThisApproach?: string;
  strategyBody?: string;
  creators: ClientReviewSourceSnapshotCreator[];
  content: ClientContentRow[];
  timeline: {
    durationWeeks: number | null;
    durationLabel: string;
    phases: ClientTimelinePhase[];
  };
  commercial: ClientCommercialSummary;
  mediaPlanSummary?: ClientMediaPlanSummary;
  quotation?: {
    id: string;
    serialNumber: string | null;
    name: string;
    version: string | null;
    lines: Array<{ creatorId: string; label: string; amount: number }>;
  };
  creatorIds: string[];
  clientUpdate?: {
    updatedAt: string;
    items: string[];
  };
};

export type ClientReviewRecord = {
  id: string;
  campaignObjectId: string | null;
  frozenVersion: number;
  reviewNumber: number;
  status: ClientReviewStatus;
  source: ClientReviewSource;
  clientLabel: string | null;
  brandName: string | null;
  campaignName: string | null;
  conversationId: string | null;
  campaignHeaderId: string | null;
  shortlistId: string | null;
  quotationId: string | null;
  sourceSnapshot: ClientReviewSourceSnapshot | null;
  packageFingerprint: StudioPackageSourceState | Record<string, unknown>;
  selectionState: Record<string, ClientCreatorSelectionState>;
  approvedCreatorIds: string[] | null;
  approvedCommercial: ClientCommercialSummary | null;
  approvedAt: string | null;
  approvedByLabel: string | null;
  changeRequestSummary: string | null;
  changeRequestAreas: ClientChangeArea[];
  supersededBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientCreatorCard = {
  creatorId: string;
  displayName: string;
  handle?: string;
  platform?: string;
  followers?: number;
  engagementRate?: number;
  country?: string;
  city?: string;
  category?: string;
  niche?: string;
  categories?: string[];
  audienceHighlight?: string;
  fitExplanation?: string;
  deliverables?: string;
  deliverableItems?: ClientDeliverableItem[];
  investmentAmount?: number;
  investmentCurrency?: string;
  avatarUrl?: string;
  profileUrl?: string;
  bio?: string;
  notes?: string;
  avgLikes?: number;
  avgComments?: number;
  avgViews?: number;
  estimatedReach?: number;
  estimatedEngagements?: number;
  cpe?: number;
  matchPercent?: number;
  matchConfidence?: number;
  matchExplanation?: string;
  matchEvidence?: string[];
  tier?: string;
  brandMentions?: string[];
  selection: ClientCreatorSelectionState;
  contentExamples: ClientContentPost[];
  contentFeed?: ClientContentPost[];
  audience?: ClientAudienceBrief;
  performance?: ClientPerformanceBrief;
  historical?: ClientHistoricalMonth[];
  briefFrozenAt?: string;
};

export type ClientCreatorBrief = {
  creatorId: string;
  displayName: string;
  handle?: string;
  platform?: string;
  location?: string;
  bio?: string;
  notes?: string;
  followers?: number;
  engagementRate?: number;
  avatarUrl?: string;
  profileUrl?: string;
  audience: ClientAudienceBrief | null;
  performance: ClientPerformanceBrief | null;
  historical: ClientHistoricalMonth[];
  contentFeed: ClientContentPost[];
  campaignFit?: string;
  categories: string[];
  niche?: string;
  brandMentions: string[];
  matchPercent?: number;
  matchConfidence?: number;
  matchExplanation?: string;
  matchEvidence: string[];
  deliverableItems: ClientDeliverableItem[];
  deliverables?: string;
  investmentAmount?: number;
  investmentCurrency?: string;
  frozen: boolean;
};

export type ClientCommercialLine = {
  label: string;
  amount?: number;
  note?: string;
};

export type ClientCommercialSummary = {
  currency: string;
  creatorInvestment: number;
  feeAmount?: number;
  totalInvestment: number;
  /** Full quotation / package total. Does not change with client selection. */
  quotationTotal: number;
  lines: ClientCommercialLine[];
  selectedCount: number;
  totalCount: number;
};

export type ClientContentRow = {
  creatorId?: string;
  creatorName: string;
  platform: string;
  deliverable: string;
  contentConcept?: string;
  keyMessage?: string;
  hook?: string;
  cta?: string;
  timing?: string;
};

export type ClientTimelinePhase = {
  week: number;
  label: string;
  activities: string[];
};

export type ClientComment = {
  id: string;
  targetType: ClientCommentTargetType;
  targetId: string | null;
  authorKind: "client" | "internal";
  authorLabel: string;
  message: string;
  status: "open" | "resolved";
  createdAt: string;
};

export type ClientActivityEvent = {
  id: string;
  eventType: string;
  actorKind: "client" | "internal" | "system";
  actorLabel: string | null;
  summary: string;
  createdAt: string;
};

export type ClientOverview = {
  brandName: string;
  campaignName: string;
  clientLabel: string;
  objective?: string;
  audience?: string;
  market?: string;
  durationLabel?: string;
  platforms: string[];
  deliverables: string[];
  creatorCount: number;
  whyThisApproach: string;
  commercial: ClientCommercialSummary;
};

export type ClientWorkspaceView = {
  review: ClientReviewRecord;
  newerReviewNumber: number | null;
  overview: ClientOverview;
  strategyBody?: string;
  creators: ClientCreatorCard[];
  content: ClientContentRow[];
  timeline: {
    durationWeeks: number | null;
    durationLabel: string;
    phases: ClientTimelinePhase[];
  };
  commercial: ClientCommercialSummary;
  /** Full-roster forecast for overview KPIs. Calculator uses mediaPlanSummary. */
  packageSummary: ClientMediaPlanSummary;
  mediaPlanSummary: ClientMediaPlanSummary;
  quotation?: ClientReviewSourceSnapshot["quotation"];
  visibleSections: ClientWorkspaceSectionId[];
  comments: ClientComment[];
  activity: ClientActivityEvent[];
  canDecide: boolean;
  clientUpdate?: {
    updatedAt: string;
    items: string[];
  };
};

export type ClientWorkspaceEntry = {
  brandName: string;
  campaignName: string;
  clientLabel: string;
  reviewNumber: number;
  status: ClientReviewStatus;
  statusLabel: string;
  lastUpdated: string;
  actionRequired: string;
};

export type ClientWorkspaceSection = ClientWorkspaceSectionId;
