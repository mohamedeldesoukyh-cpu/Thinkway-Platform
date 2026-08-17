import type { StudioPackageSourceState } from "@/features/campaign-studio/services/studio-package-readiness";

import type {
  ClientChangeArea,
  ClientCommentTargetType,
  ClientCreatorSelectionState,
  ClientReviewSource,
  ClientReviewStatus,
  ClientWorkspaceSectionId,
} from "./constants";

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
  audienceHighlight?: string;
  fitExplanation?: string;
  deliverables?: string;
  investmentAmount?: number;
  investmentCurrency?: string;
  avatarUrl?: string;
  bio?: string;
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
  quotation?: {
    id: string;
    serialNumber: string | null;
    name: string;
    version: string | null;
    lines: Array<{ creatorId: string; label: string; amount: number }>;
  };
  creatorIds: string[];
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
  audienceHighlight?: string;
  fitExplanation?: string;
  deliverables?: string;
  investmentAmount?: number;
  investmentCurrency?: string;
  avatarUrl?: string;
  bio?: string;
  selection: ClientCreatorSelectionState;
  contentExamples: Array<{
    url?: string | null;
    thumbnail?: string | null;
    likes?: number | null;
  }>;
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
  quotation?: ClientReviewSourceSnapshot["quotation"];
  visibleSections: ClientWorkspaceSectionId[];
  comments: ClientComment[];
  activity: ClientActivityEvent[];
  canDecide: boolean;
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
