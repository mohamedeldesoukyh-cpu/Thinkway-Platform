import type { VendorIoRow } from "@/lib/domains/io/types";
import type { DocumentLifecycleSnapshot } from "@/lib/document-lifecycle/types";

export function vendorIoRowToLifecycleSnapshot(
  row: Pick<
    VendorIoRow,
    | "id"
    | "status"
    | "delivery_method"
    | "delivery_status"
    | "sent_at"
    | "approved_at"
    | "attachment_url"
    | "amount"
    | "currency_code"
  > & {
    is_superseded?: boolean | null;
    lifecycle_reason_code?: string | null;
    lifecycle_reason_detail?: string | null;
  }
): DocumentLifecycleSnapshot {
  return {
    documentType: "vendor_io",
    id: row.id,
    status: row.status,
    isSuperseded: Boolean(row.is_superseded),
    deliveryMethod: row.delivery_method,
    deliveryStatus: row.delivery_status,
    sentAt: row.sent_at,
    approvedAt: row.approved_at,
    attachmentUrl: row.attachment_url,
    lifecycleReasonCode: row.lifecycle_reason_code ?? null,
    lifecycleReasonDetail: row.lifecycle_reason_detail ?? null,
    amount: row.amount,
    currencyCode: row.currency_code,
  };
}
