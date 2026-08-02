/**
 * Enterprise Change Impact Engine — types.
 * Intelligence layer above Document Lifecycle (state transitions only).
 */

import type {
  BusinessChangeEventType,
  DocumentLifecycleReasonCode,
  EnterpriseDocumentType,
  PlannedDocumentReaction,
} from "@/lib/document-lifecycle/types";

/** Impact severity (Change Impact Engine). Maps into Decision Center severities. */
export type ChangeImpactSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type ChangeImpactObjectType =
  | "campaign"
  | "campaign_line"
  | "influencer"
  | "assignment"
  | "budget"
  | "deliverable"
  | "vendor_io"
  | "client_io"
  | "other";

export type ChangeImpactAffectedObject = {
  objectType: ChangeImpactObjectType;
  objectId: string | null;
  objectLabel: string;
  role: "source" | "affected" | "related";
};

export type ChangeImpactDocumentImpact = {
  documentType: EnterpriseDocumentType;
  documentId: string;
  documentLabel: string;
  fromStatus: string | null;
  plannedToStatus: string;
  severity: ChangeImpactSeverity;
  impactExplanation: string;
  recommendedActions: string[];
};

export type ChangeImpactOwner =
  | "Operations"
  | "Commercial"
  | "Finance"
  | "Traffic"
  | "Executive";

export type ChangeImpactRecommendedAction = {
  id: string;
  label: string;
  /** Workspace tab hint for Decision Center CTAs. */
  actionTab?:
    | "vendor-io"
    | "client-io"
    | "lines"
    | "billing"
    | "overview"
    | "deliverables";
  priority: number;
  /** Responsible owner for this action. */
  owner: ChangeImpactOwner;
};

/**
 * Mandatory explainability — every assessment must answer these five questions.
 * No generic status-only messages.
 */
export type ChangeImpactExplainability = {
  whatChanged: string;
  whyImportant: string;
  whatAffected: string;
  whatShouldHappenNext: string;
  whoOwnsTheAction: ChangeImpactOwner;
};

export type ChangeImpactNotificationIntent = {
  audience: "operations" | "commercial" | "finance" | "executive";
  channel: "in_app" | "email" | "future";
  title: string;
  body: string;
  payload?: Record<string, unknown>;
};

/** AI-ready recommendation payload — not executed in this release. */
export type ChangeImpactAiRecommendation = {
  summary: string;
  recommendBulkRegenerate: boolean;
  estimatedImpact: {
    amountDelta: number | null;
    currencyCode: string | null;
    note: string | null;
  } | null;
  suggestedActions: string[];
  confidence: "low" | "medium" | "high";
};

export type ChangeImpactAssessment = {
  eventType: BusinessChangeEventType;
  reasonCode: DocumentLifecycleReasonCode;
  reasonDetail: string;
  severity: ChangeImpactSeverity;
  /** Product label: Critical · Major · Moderate · Minor · Informational */
  severityLabel: import("@/lib/change-impact/severity").ChangeImpactSeverityLabel;
  businessImpactSummary: string;
  businessImpactDetail: string;
  explainability: ChangeImpactExplainability;
  responsibleOwner: ChangeImpactOwner;
  affectedObjects: ChangeImpactAffectedObject[];
  documentImpacts: ChangeImpactDocumentImpact[];
  recommendedActions: ChangeImpactRecommendedAction[];
  notificationIntents: ChangeImpactNotificationIntent[];
  aiRecommendation: ChangeImpactAiRecommendation;
  /** Document lifecycle reactions to apply (state transitions only). */
  lifecycleReactions: PlannedDocumentReaction[];
};

export type ChangeImpactDecisionSignal = {
  assessmentId: string;
  severity: ChangeImpactSeverity;
  severityLabel: import("@/lib/change-impact/severity").ChangeImpactSeverityLabel;
  title: string;
  reason: string;
  impact: string;
  primaryAction: string;
  actionTab: NonNullable<ChangeImpactRecommendedAction["actionTab"]>;
  objectKind: "vendor_io" | "client_io" | "campaign" | "assignment" | "creator";
  objectLabel: string;
  objectRef: string;
  recordId: string | null;
  responsibleOwner: ChangeImpactOwner;
  createdAt: string;
};

export type ApplyChangeImpactInput = {
  eventType: BusinessChangeEventType;
  reasonCode: DocumentLifecycleReasonCode;
  reasonDetail: string;
  campaignHeaderId: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  vendorIoIds?: string[];
  influencerId?: string | null;
  campaignLineIds?: string[];
  estimatedImpact?: {
    amountDelta?: number | null;
    currencyCode?: string | null;
    note?: string | null;
  };
};
