/**
 * Commercial Revision — Phase 4 domain types.
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §8
 */

import type {
  CommercialLineId,
  MasterCommercialValues,
  MasterFieldChange,
} from "./types";

export type CommercialRevisionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled"
  | "applied";

export type CommercialRevisionLineInput = {
  commercialLineId: CommercialLineId;
  assignmentIds?: string[];
  oldValues: MasterCommercialValues;
  newValues: MasterCommercialValues;
  changedFields: string[];
  fieldChanges?: MasterFieldChange[];
};

export type CommercialRevisionRecord = {
  id: string;
  campaignHeaderId: string;
  quotationId: string;
  revisionNumber: number;
  commercialVersionNumber: number | null;
  status: CommercialRevisionStatus;
  reason: string;
  comments: string | null;
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  decisionNotes: string | null;
  appliedAt: string | null;
  concurrencyTokens: Record<string, string>;
  lines: CommercialRevisionLineInput[];
};

export type CommercialVersionHistoryEntry = {
  versionNumber: number;
  revisionNumber: number | null;
  revisionId: string | null;
  campaignHeaderId: string;
  createdBy: string | null;
  approvedBy: string | null;
  date: string;
  reason: string | null;
  fieldChangeSummary: MasterFieldChange[];
  snapshotId: string;
};

export type CreateCommercialRevisionInput = {
  actorId: string;
  campaignHeaderId: string;
  quotationId: string;
  reason: string;
  comments?: string | null;
  lines: CommercialRevisionLineInput[];
  concurrencyTokens?: Record<string, string>;
};

export type CommercialRevisionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "NOT_FOUND"
        | "INVALID_STATUS"
        | "FINANCE_NOT_LOCKED"
        | "CONCURRENCY_CONFLICT"
        | "PERMISSION"
        | "LINE_MISSING"
        | "PENDING_EXISTS"
        | "APPLY_FAILED";
      message: string;
    };
