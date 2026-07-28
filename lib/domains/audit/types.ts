/** Shared audit domain types. */

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "approve"
  | "reject"
  | "submit"
  | "publish"
  | "void"
  | "export";

export type InsertAuditLogInput = {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type FinanceAuditEvent =
  | "cn_created"
  | "cn_approved"
  | "cn_posted"
  | "cn_cancelled"
  | "cn_unposted"
  | "cn_reopened"
  | "dn_created"
  | "dn_approved"
  | "dn_posted"
  | "dn_cancelled"
  | "dn_unposted"
  | "dn_reopened"
  | "invoice_posted"
  | "invoice_unposted"
  | "invoice_regenerated"
  | "invoice_voided"
  | "invoice_cancelled"
  | "campaign_cancelled"
  | "campaign_reopened"
  | "vendor_io_cancelled"
  | "client_io_cancelled"
  | "posting_created"
  | "posting_posted"
  | "posting_reversed"
  | "erp_sync_sent"
  | "erp_sync_failed";

export type ClientOnboardingAuditEvent =
  | "client.promoted"
  | "client.onboarding_status_changed"
  | "client.duplicate_overridden"
  | "client.existing_linked";

export type QuotationLifecycleAuditEvent =
  | "quotation.creator_added"
  | "quotation.creator_removed"
  | "quotation.commercial_updated"
  | "quotation.deliverables_updated"
  | "quotation.version_created"
  | "quotation.campaign_created"
  | "quotation.converted_to_assignments"
  | "quotation.shortlist_created"
  | "quotation.client_promoted"
  | "quotation.brand_promoted"
  | "quotation.sync_shortlist_to_quotation"
  | "quotation.sync_quotation_to_shortlist"
  | "quotation.tentative_schedule_imported"
  | "quotation.generated_from_campaign_plan";

export type AuditVerdict = "PASS" | "WARN" | "FAIL";

export type AuditVerdictResult = {
  verdict: AuditVerdict;
  failReasons: string[];
  warnReasons: string[];
};
