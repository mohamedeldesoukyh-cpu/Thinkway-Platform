/**
 * Vendor IO bulk mutators — wrap existing per-row server actions.
 * No new API / DB / schema. Partial success preserved by the shared runner.
 *
 * Always set bulk_defer_revalidate so per-row actions do not refresh the
 * workspace mid-run. The Platform Bulk Runner refreshes once at the end.
 */

import { appendBulkDeferRevalidate } from "@/components/workspace/bulk-operations/bulk-defer-revalidate";
import { sendVendorIoAction } from "@/features/io/actions";
import { recordVendorIoManualApprovalAction } from "@/features/io/record-vendor-io-manual-approval-action";
import { updateVendorIoAttachmentUrlAction } from "@/features/io/update-vendor-io-attachment-url-action";
import { updateVendorIoSpecialPaymentTermsAction } from "@/features/io/update-vendor-io-special-payment-terms-action";
import { canRecordVendorIoManualApproval } from "@/features/io/components/vendor-io-manual-approve-button";
import {
  vendorIoAlreadyAccepted,
  vendorIoNeedsSend,
} from "@/features/io/bulk/vendor-io-bulk-helpers";
import type { VendorIoRow } from "@/features/io/types";

export {
  describeVendorIoSendBulkLabel,
  downloadTextFile,
  exportVendorIoRowsCsv,
  vendorIoAlreadyAccepted,
  vendorIoAlreadySentOrDelivered,
  vendorIoIsManualDeliveryCandidate,
  vendorIoNeedsSend,
} from "@/features/io/bulk/vendor-io-bulk-helpers";

function bulkFormData(row: VendorIoRow): FormData {
  const formData = new FormData();
  formData.set("id", row.id);
  formData.set("campaign_header_id", row.campaign_header_id);
  appendBulkDeferRevalidate(formData);
  return formData;
}

export async function mutateVendorIoSend(row: VendorIoRow) {
  if (!vendorIoNeedsSend(row)) {
    return {
      ok: true,
      skipped: true,
      message: "Already sent, delivered, or approved.",
      id: row.id,
    };
  }
  const result = await sendVendorIoAction({ ok: false }, bulkFormData(row));
  return { ...result, id: row.id };
}

export async function mutateVendorIoMarkAccepted(row: VendorIoRow) {
  if (vendorIoAlreadyAccepted(row)) {
    return {
      ok: true,
      skipped: true,
      message: "Already accepted.",
      id: row.id,
    };
  }
  if (!canRecordVendorIoManualApproval(row)) {
    return {
      ok: false,
      message: "Deliver or send Vendor IO before recording acceptance.",
      id: row.id,
    };
  }
  const result = await recordVendorIoManualApprovalAction(
    { ok: false },
    bulkFormData(row)
  );
  // Server may also short-circuit already-approved without revalidate.
  if (result.ok && result.message?.toLowerCase().includes("already approved")) {
    return {
      ok: true,
      skipped: true,
      message: "Already accepted.",
      id: row.id,
    };
  }
  return { ...result, id: row.id };
}

export async function mutateVendorIoSignedUrl(row: VendorIoRow, url: string) {
  const trimmed = url.trim();
  if (trimmed && (row.attachment_url ?? "").trim() === trimmed) {
    return {
      ok: true,
      skipped: true,
      message: "Already uploaded.",
      id: row.id,
    };
  }
  const formData = bulkFormData(row);
  formData.set("attachment_url", trimmed);
  const result = await updateVendorIoAttachmentUrlAction({ ok: false }, formData);
  return { ...result, id: row.id };
}

export async function mutateVendorIoPaymentTerms(row: VendorIoRow, terms: string) {
  const next = terms.trim();
  if ((row.special_payment_terms ?? "").trim() === next) {
    return {
      ok: true,
      skipped: true,
      message: "Payment terms already set.",
      id: row.id,
    };
  }
  const formData = bulkFormData(row);
  formData.set("special_payment_terms", next);
  const result = await updateVendorIoSpecialPaymentTermsAction(
    { ok: false },
    formData
  );
  return { ...result, id: row.id };
}
