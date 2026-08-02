/**
 * Pure Vendor IO bulk helpers (no server actions) — safe for unit tests.
 */

import type { VendorIoRow } from "@/features/io/types";
import { hasValidVendorEmail } from "@/lib/io/vendor-io-delivery";

export function vendorIoNeedsSend(row: VendorIoRow): boolean {
  if (row.is_superseded) return false;
  if (row.status === "approved") return false;
  return ["draft", "generated", "sent", "rejected"].includes(
    (row.status ?? "").toLowerCase()
  );
}

export function vendorIoIsManualDeliveryCandidate(row: VendorIoRow): boolean {
  return !hasValidVendorEmail(row.influencer_email);
}

export function describeVendorIoSendBulkLabel(rows: VendorIoRow[]): string {
  if (rows.length === 0) return "Send Selected";
  const manual = rows.filter(vendorIoIsManualDeliveryCandidate).length;
  if (manual === rows.length) return "Mark Delivered Manually";
  if (manual === 0) return "Send Selected";
  return "Send / Mark Delivered";
}

export function exportVendorIoRowsCsv(rows: VendorIoRow[]): string {
  const headers = [
    "document_number",
    "influencer_name",
    "status",
    "delivery_method",
    "delivery_status",
    "amount",
    "currency_code",
    "attachment_url",
    "special_payment_terms",
  ];
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.document_number,
        row.influencer_name,
        row.status,
        row.delivery_method,
        row.delivery_status,
        row.amount,
        row.currency_code,
        row.attachment_url,
        row.special_payment_terms,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
