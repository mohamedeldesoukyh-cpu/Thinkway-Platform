/**
 * Commercial SSOT — shared types (Phase 1 foundation).
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md
 */

/** Immutable Commercial Line ID (= quotation_items.id / Origin on Assignments). */
export type CommercialLineId = string;

export type CommercialFieldLevel = "master" | "derived" | "operational";

export type CommercialDocumentSide = "quotation" | "campaign";

/**
 * Logical Master keys shared across Quotation and Campaign views.
 * Persistence columns are mapped in the field registry — never join by position.
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

export type FinanceLockResult = {
  locked: boolean;
  reasons: string[];
};

export type CommercialSyncSource =
  | { side: "quotation"; quotationItemId: string }
  | { side: "campaign"; assignmentId: string };

export type ApplyMasterChangeInput = {
  actorId: string;
  source: CommercialSyncSource;
  /** Master fields being changed (logical keys only). */
  changes: MasterCommercialValues;
  /**
   * When true, skip confirmation semantics (server already confirmed).
   * Phase 1 has no UI — callers set this after their own confirmation.
   */
  confirmed: boolean;
  /** Optional human reason for audit. */
  reason?: string | null;
};

export type ApplyMasterChangeResult =
  | {
      ok: true;
      commercialLineId: CommercialLineId;
      quotationId: string;
      campaignHeaderId: string | null;
      assignmentIds: string[];
      applied: MasterCommercialValues;
      allocation: "single" | "equal_split" | "rates_only";
    }
  | {
      ok: false;
      code:
        | "NOT_CONFIRMED"
        | "UNKNOWN_ORIGIN"
        | "NON_MASTER_FIELD"
        | "FINANCE_LOCKED"
        | "EMPTY_CHANGES"
        | "WRITE_FAILED";
      message: string;
      financeLock?: FinanceLockResult;
      rejectedFields?: string[];
    };

/** Ports injected into CommercialSynchronizationService (testable; Supabase later). */
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
};

export type CommercialAuditEntry = {
  event:
    | "commercial.master_synced"
    | "commercial.sync_blocked_finance_lock"
    | "commercial.sync_rejected"
    | "commercial.sync_not_confirmed";
  actorId: string;
  commercialLineId: CommercialLineId | null;
  quotationId: string | null;
  campaignHeaderId: string | null;
  assignmentIds: string[];
  sourceSide: CommercialDocumentSide;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};
