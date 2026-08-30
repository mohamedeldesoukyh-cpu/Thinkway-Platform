import type { StudioPackageSourceState } from "@/features/campaign-studio/services/studio-package-readiness";
import type { IdentityLogo } from "@/lib/entity-logos/identity-logo";

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

export type ClientBrandMention = {
  name: string;
  handle?: string;
  mentionCount?: number;
  mentionsLast180Days?: number;
};

export type ClientContentCategory = {
  label: string;
  percent?: number;
  postCount?: number;
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

export type ClientCreatorPlatformStats = {
  platform: string;
  handle?: string;
  followers?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgComments?: number;
  avgViews?: number;
  profileUrl?: string;
};

export type ClientReviewSourceSnapshotCreator = {
  creatorId: string;
  displayName: string;
  handle?: string;
  platform?: string;
  platformAccounts?: ClientCreatorPlatformStats[];
  followers?: number;
  engagementRate?: number;
  country?: string;
  city?: string;
  category?: string;
  niche?: string;
  categories?: string[];
  contentCategories?: ClientContentCategory[];
  audienceHighlight?: string;
  fitExplanation?: string;
  deliverables?: string;
  deliverableItems?: ClientDeliverableItem[];
  serviceDescription?: string;
  investmentAmount?: number;
  investmentCurrency?: string;
  agencyFeeAmount?: number;
  usageRightsAmount?: number;
  originalInvestmentAmount?: number;
  originalInvestmentCurrency?: string;
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
  brandMentions?: ClientBrandMention[];
  contentFeed?: ClientContentPost[];
  audience?: ClientAudienceBrief;
  performance?: ClientPerformanceBrief;
  historical?: ClientHistoricalMonth[];
  influencerId?: string;
  shortlistItemId?: string;
  profileId?: string;
  unifiedId?: string;
  briefFrozenAt?: string;
  briefBackfillDone?: boolean;
  thinkwayStatus?: import("./selection-flow").ClientThinkwayStatus;
  quotationEligible?: boolean;
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
  identityLogo?: IdentityLogo;
  clientSelection?: import("./selection-flow").ClientSelectionFreeze;
  clientUpdate?: {
    updatedAt: string;
    items: string[];
    acknowledgedAt?: string;
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
  journeyId: string | null;
  firstViewedAt: string | null;
};

export type ClientCreatorCard = {
  creatorId: string;
  displayName: string;
  handle?: string;
  platform?: string;
  platformAccounts?: ClientCreatorPlatformStats[];
  followers?: number;
  engagementRate?: number;
  country?: string;
  city?: string;
  category?: string;
  niche?: string;
  categories?: string[];
  contentCategories?: ClientContentCategory[];
  audienceHighlight?: string;
  fitExplanation?: string;
  deliverables?: string;
  deliverableItems?: ClientDeliverableItem[];
  serviceDescription?: string;
  investmentAmount?: number;
  investmentCurrency?: string;
  agencyFeeAmount?: number;
  usageRightsAmount?: number;
  originalInvestmentAmount?: number;
  originalInvestmentCurrency?: string;
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
  brandMentions?: ClientBrandMention[];
  selection: ClientCreatorSelectionState;
  contentExamples: ClientContentPost[];
  contentFeed?: ClientContentPost[];
  audience?: ClientAudienceBrief;
  performance?: ClientPerformanceBrief;
  historical?: ClientHistoricalMonth[];
  briefFrozenAt?: string;
  thinkwayStatus?: import("./selection-flow").ClientThinkwayStatus;
  quotationEligible?: boolean;
  influencerId?: string;
  shortlistItemId?: string;
  profileId?: string;
  unifiedId?: string;
};

export type ClientCreatorBrief = {
  creatorId: string;
  displayName: string;
  handle?: string;
  platform?: string;
  platformAccounts?: ClientCreatorPlatformStats[];
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
  contentCategories: ClientContentCategory[];
  niche?: string;
  brandMentions: ClientBrandMention[];
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
  pricedSelectedCount?: number;
  unpricedSelectedCount?: number;
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
  stage?: ClientReviewSource;
};

export type ClientActivityEvent = {
  id: string;
  eventType: string;
  actorKind: "client" | "internal" | "system";
  actorLabel: string | null;
  summary: string;
  createdAt: string;
};

export type ClientWorkspaceJourney = {
  id: string;
  canonicalReviewId: string;
  memberReviewIds: string[];
  shortlistStage: import("./constants").ClientShortlistStage;
  quotationStage: import("./constants").ClientQuotationStage;
  campaignStarted: boolean;
  performanceStarted: boolean;
  invoiceStarted: boolean;
  campaignHeaderId: string | null;
  quotationId: string | null;
  shortlistId: string | null;
  historical: boolean;
  canApproveShortlist: boolean;
  canApproveQuotation: boolean;
  canConfirmCreators?: boolean;
  canApproveFinalQuotation?: boolean;
  selectionConfirmed?: boolean;
  clientApprovedCreatorIds?: string[];
  commerciallyIncludedCreatorIds?: string[];
  pendingCommercialApprovalCreatorIds?: string[];
  quotationExtensionCount?: number;
  clientSelection?: import("./selection-flow").ClientSelectionFreeze;
  approvedQuotationCount?: number;
  canRequestShortlistChanges: boolean;
  canRequestQuotationChanges: boolean;
  canRejectQuotation: boolean;
  movedToCampaign: boolean;
};

export type ClientRosterDiffKind = "existing" | "added" | "removed";

export type ClientRosterDiffRow = {
  creatorId: string;
  displayName: string;
  kind: ClientRosterDiffKind;
  shortlistInvestment?: number;
  quotationInvestment?: number;
  investmentDelta?: number;
  investmentChanged: boolean;
  deliverablesChanged: boolean;
  shortlistDeliverables?: string;
  quotationDeliverables?: string;
};

export type ClientStageDiff = {
  commercialChangedAfterShortlistApproval: boolean;
  hasRosterChange: boolean;
  rows: ClientRosterDiffRow[];
  summaryItems: string[];
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
  /** True when Thinkway stopped the share link — workspace renders dimmed with request access. */
  linkExpired?: boolean;
  journey?: ClientWorkspaceJourney;
  stageDiff?: ClientStageDiff | null;
  clientEmails?: string[];
  clientUpdate?: {
    updatedAt: string;
    items: string[];
    acknowledgedAt?: string;
  };
  /** Campaign Workspace execution projection — never a second schedule/live engine. */
  campaignExecution?: import("./campaign-execution").ClientCampaignExecution;
  /** Current-version content review projection. Independent of quotation and live status. */
  campaignContent?: import("./content-approval").ClientCampaignContent;
  /** Thinkway-controlled. Clients never see original currency unless this is on. */
  showOriginalCurrency?: boolean;
  /** Thinkway-controlled. Clients see only Total Investment when this is on. */
  hideCostAndFees?: boolean;
  /** Group logo first, then client logo. Brand logos are not used here. */
  identityLogo?: IdentityLogo | null;
  /** Legal-entity Client Workspace entitlement. Absent only in legacy test fixtures. */
  entitlement?: import("./entitlement").ClientWorkspaceEntitlementView;
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
  identityLogo?: IdentityLogo | null;
};

export type ClientWorkspaceSection = ClientWorkspaceSectionId;
