/**
 * Commercial SSOT — shared types.
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md
 */

import type {
  CampaignFinanceLockReason,
  FinanceLockResult,
} from "@/lib/finance/campaign-finance-lock";

export type { CampaignFinanceLockReason, FinanceLockResult };

/** Immutable Commercial Line ID (= quotation_items.id / Origin on Assignments). */
export type CommercialLineId = string;

export type CommercialFieldLevel = "master" | "derived" | "operational";

export type CommercialDocumentSide = "quotation" | "campaign";

/**
 * Logical Master keys shared across Quotation and Campaign views.
 * Persistence columns are mapped in the field registry — never join by position.
 * Adding a Master field = registry update only; sync logic stays generic.
 */
export type CommercialMasterFieldKey =
  | "creator_cost"
  | "client_revenue"
  | "cost_currency"
  | "exchange_rate"
  | "agency_fee_percent"
  | "commercial_input_mode"
  | "gp_pct_input"
  | "gp_value_input"
  | "usage_rights_amount"
  | "usage_rights_cost"
  | "revenue_vat_percent"
  | "cost_vat_percent"
  | "revenue_vat_exempt"
  | "cost_vat_exempt";

export type CommercialDerivedFieldKey =
  | "total_cost"
  | "total_revenue"
  | "gross_profit"
  | "gross_margin_pct"
  | "agency_fee_amount"
  | "cost_egp"
  | "revenue_egp"
  | "gp_value_egp"
  | "af_value_egp"
  | "profit"
  | "profit_margin"
  | "quotation_totals"
  | "campaign_financial_summary";

export type CommercialOperationalFieldKey =
  | "campaign_status"
  | "assignment_status"
  | "creator_status"
  | "publishing_calendar"
  | "publishing_dates"
  | "approval_status"
  | "creator_acceptance"
  | "deliverable_status"
  | "asset_urls"
  | "tracking_links"
  | "performance_metrics"
  | "ai_scores"
  | "operational_notes"
  | "internal_comments";

export type MasterCommercialValues = Partial<
  Record<CommercialMasterFieldKey, string | number | boolean | null>
>;

export type CommercialLineRegistryEntry = {
  commercialLineId: CommercialLineId;
  quotationId: string;
  quotationItemId: string;
  campaignHeaderId: string | null;
  /** campaign_lines.id values that Origin → this Commercial Line (1:N). */
  assignmentIds: string[];
};

export type MasterFieldChange = {
  field: CommercialMasterFieldKey;
  label: string;
  oldValue: string | number | boolean | null | undefined;
  newValue: string | number | boolean | null | undefined;
};

export type CommercialSyncSource =
  | { side: "quotation"; quotationItemId: string }
  | { side: "campaign"; assignmentId: string };

export type CommercialSyncResultStatus =
  | "synced"
  | "blocked"
  | "rejected"
  | "not_confirmed"
  | "duplicate"
  | "conflict"
  | "rolled_back";

export type ApplyMasterChangeInput = {
  actorId: string;
  source: CommercialSyncSource;
  /** Master fields being changed (logical keys only). */
  changes: MasterCommercialValues;
  /**
   * When true, caller confirmed dual-document update.
   * Phase 2 UI sets this after the confirmation dialog.
   */
  confirmed: boolean;
  /** Optional human reason for audit. */
  reason?: string | null;
  /**
   * Client-generated key to prevent duplicate synchronization
   * (double-submit / retry). Same key returns prior success without re-writing.
   */
  idempotencyKey?: string | null;
  /**
   * Optimistic concurrency token for the Commercial Line.
   * When set and mismatched, sync fails with CONCURRENCY_CONFLICT (no write).
   */
  expectedConcurrencyToken?: string | null;
  /**
   * Phase 4 — approved Commercial Revision may bypass Finance Lock.
   * Only CommercialRevisionService.apply may set this after validation.
   */
  approvedRevision?: {
    revisionId: string;
    revisionNumber: number;
  } | null;
};

export type ApplyMasterChangeResult =
  | {
      ok: true;
      commercialLineId: CommercialLineId;
      quotationId: string;
      campaignHeaderId: string | null;
      assignmentIds: string[];
      applied: MasterCommercialValues;
      fieldChanges: MasterFieldChange[];
      allocation: "single" | "equal_split" | "rates_only" | "noop";
      concurrencyToken: string | null;
      duplicate?: boolean;
      recalculated: boolean;
    }
  | {
      ok: false;
      code:
        | "NOT_CONFIRMED"
        | "UNKNOWN_ORIGIN"
        | "NON_MASTER_FIELD"
        | "FINANCE_LOCKED"
        | "EMPTY_CHANGES"
        | "WRITE_FAILED"
        | "CONCURRENCY_CONFLICT"
        | "DUPLICATE_IN_FLIGHT";
      message: string;
      financeLock?: FinanceLockResult;
      rejectedFields?: string[];
    };

/** Ports injected into CommercialSynchronizationService (testable; Supabase adapter in Phase 2). */
export type CommercialSyncPorts = {
  resolveByCommercialLineId: (
    commercialLineId: CommercialLineId
  ) => Promise<CommercialLineRegistryEntry | null>;
  resolveByQuotationItemId: (
    quotationItemId: string
  ) => Promise<CommercialLineRegistryEntry | null>;
  resolveByAssignmentId: (
    assignmentId: string
  ) => Promise<CommercialLineRegistryEntry | null>;
  loadQuotationMaster: (
    quotationItemId: string
  ) => Promise<MasterCommercialValues | null>;
  loadAssignmentMaster: (
    assignmentId: string
  ) => Promise<MasterCommercialValues | null>;
  writeQuotationMaster: (
    quotationItemId: string,
    values: MasterCommercialValues
  ) => Promise<void>;
  writeAssignmentMaster: (
    assignmentId: string,
    values: MasterCommercialValues
  ) => Promise<void>;
  recalculateQuotationDerived: (quotationId: string) => Promise<void>;
  recalculateCampaignDerived: (campaignHeaderId: string) => Promise<void>;
  isFinanceLocked: (campaignHeaderId: string) => Promise<FinanceLockResult>;
  writeAudit: (entry: CommercialAuditEntry) => Promise<void>;
  /**
   * Run writes atomically. On throw, ports must roll back Master writes
   * so Quotation and Campaign never diverge from a partial sync.
   */
  runInTransaction: <T>(work: () => Promise<T>) => Promise<T>;
  /** Current concurrency token for a Commercial Line (e.g. quote item updated_at). */
  loadConcurrencyToken: (
    commercialLineId: CommercialLineId
  ) => Promise<string | null>;
  /** Persist new token after successful sync. */
  storeConcurrencyToken: (
    commercialLineId: CommercialLineId,
    token: string
  ) => Promise<void>;
  /** Return prior successful result for an idempotency key, if any. */
  getIdempotentResult: (
    idempotencyKey: string
  ) => Promise<Extract<ApplyMasterChangeResult, { ok: true }> | null>;
  /** Remember successful result for an idempotency key. */
  putIdempotentResult: (
    idempotencyKey: string,
    result: Extract<ApplyMasterChangeResult, { ok: true }>
  ) => Promise<void>;
  /** Try to acquire in-flight lock for idempotency key; false if already in flight. */
  tryBeginIdempotent: (idempotencyKey: string) => Promise<boolean>;
  endIdempotent: (idempotencyKey: string) => Promise<void>;
};

export type CommercialAuditEntry = {
  event:
    | "commercial.master_synced"
    | "commercial.sync_blocked_finance_lock"
    | "commercial.sync_rejected"
    | "commercial.sync_not_confirmed"
    | "commercial.sync_rolled_back"
    | "commercial.sync_conflict";
  actorId: string;
  commercialLineId: CommercialLineId | null;
  quotationId: string | null;
  campaignHeaderId: string | null;
  assignmentIds: string[];
  sourceSide: CommercialDocumentSide;
  /** ISO timestamp — always set by the sync service. */
  occurredAt: string;
  /** Normalized result for audit consumers. */
  result: CommercialSyncResultStatus;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  /** Field-level commercial changes for Finance-readable audit. */
  fieldChanges?: MasterFieldChange[];
  metadata?: Record<string, unknown>;
};

/** Probe result used by Phase 2 UI confirmation gate. */
export type CommercialSyncLinkProbe = {
  linked: boolean;
  commercialLineId: CommercialLineId | null;
  quotationId: string | null;
  quotationSerial: string | null;
  campaignHeaderId: string | null;
  campaignDocumentNumber: string | null;
  assignmentIds: string[];
  concurrencyToken: string | null;
};
