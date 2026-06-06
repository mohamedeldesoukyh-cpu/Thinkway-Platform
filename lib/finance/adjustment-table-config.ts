import type { FinanceDocumentKind } from "@/lib/finance/status/document-kind";
import type { FinanceAuditEvent } from "@/lib/finance/audit-events";

export type AdjustmentTableKind =
  | "client_credit_note"
  | "vendor_credit_note"
  | "client_debit_note"
  | "vendor_debit_note";

export type AdjustmentTableConfig = {
  table: string;
  entity_type: string;
  document_kind: FinanceDocumentKind;
  auditPrefix: "cn" | "dn";
};

export const ADJUSTMENT_TABLE_CONFIG: Record<AdjustmentTableKind, AdjustmentTableConfig> = {
  client_credit_note: {
    table: "client_credit_notes",
    entity_type: "client_credit_note",
    document_kind: "client_credit_note",
    auditPrefix: "cn",
  },
  vendor_credit_note: {
    table: "vendor_credit_notes",
    entity_type: "vendor_credit_note",
    document_kind: "vendor_credit_note",
    auditPrefix: "cn",
  },
  client_debit_note: {
    table: "client_debit_notes",
    entity_type: "client_debit_note",
    document_kind: "client_debit_note",
    auditPrefix: "dn",
  },
  vendor_debit_note: {
    table: "vendor_debit_notes",
    entity_type: "vendor_debit_note",
    document_kind: "vendor_debit_note",
    auditPrefix: "dn",
  },
};

export type AdjustmentRow = {
  id: string;
  document_number: string;
  status: string;
  amount_after_vat: number;
  campaign_header_id: string | null;
};

export function adjustmentAuditEvent(
  kind: AdjustmentTableKind,
  action: "created" | "approved" | "posted" | "cancelled" | "reopened" | "unposted"
): FinanceAuditEvent {
  const prefix = ADJUSTMENT_TABLE_CONFIG[kind].auditPrefix;
  const key = `${prefix}_${action}`;
  const events = {
    cn_created: "cn_created",
    cn_approved: "cn_approved",
    cn_posted: "cn_posted",
    cn_cancelled: "cn_cancelled",
    cn_reopened: "cn_reopened",
    cn_unposted: "cn_unposted",
    dn_created: "dn_created",
    dn_approved: "dn_approved",
    dn_posted: "dn_posted",
    dn_cancelled: "dn_cancelled",
    dn_reopened: "dn_reopened",
    dn_unposted: "dn_unposted",
  } as const satisfies Record<string, FinanceAuditEvent>;
  return (events[key as keyof typeof events] ?? "cn_created") as FinanceAuditEvent;
}
