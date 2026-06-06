/** Finance control audit event keys (stored in audit_logs.metadata.event). */
export const FINANCE_AUDIT_EVENTS = {
  cn_created: "cn_created",
  cn_posted: "cn_posted",
  cn_cancelled: "cn_cancelled",
  cn_unposted: "cn_unposted",
  cn_reopened: "cn_reopened",
  dn_created: "dn_created",
  dn_posted: "dn_posted",
  dn_cancelled: "dn_cancelled",
  dn_unposted: "dn_unposted",
  invoice_cancelled: "invoice_cancelled",
  campaign_cancelled: "campaign_cancelled",
  vendor_io_cancelled: "vendor_io_cancelled",
  posting_created: "posting_created",
  posting_reversed: "posting_reversed",
  erp_sync_sent: "erp_sync_sent",
  erp_sync_failed: "erp_sync_failed",
} as const;

export type FinanceAuditEvent =
  (typeof FINANCE_AUDIT_EVENTS)[keyof typeof FINANCE_AUDIT_EVENTS];
