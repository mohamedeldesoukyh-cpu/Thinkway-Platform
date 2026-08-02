/**
 * Vendor IO bulk mutators — wrap existing per-row server actions.
 * No new API / DB / schema. Partial success preserved by the shared runner.
 */

import { sendVendorIoAction } from "@/features/io/actions";
import { recordVendorIoManualApprovalAction } from "@/features/io/record-vendor-io-manual-approval-action";
import { updateVendorIoAttachmentUrlAction } from "@/features/io/update-vendor-io-attachment-url-action";
import { updateVendorIoSpecialPaymentTermsAction } from "@/features/io/update-vendor-io-special-payment-terms-action";
import { canRecordVendorIoManualApproval } from "@/features/io/components/vendor-io-manual-approve-button";
import {
  vendorIoNeedsSend,
} from "@/features/io/bulk/vendor-io-bulk-helpers";
import type { VendorIoRow } from "@/features/io/types";

export {
  describeVendorIoSendBulkLabel,
  downloadTextFile,
  exportVendorIoRowsCsv,
  vendorIoIsManualDeliveryCandidate,
  vendorIoNeedsSend,
} from "@/features/io/bulk/vendor-io-bulk-helpers";

export async function mutateVendorIoSend(row: VendorIoRow) {
  if (!vendorIoNeedsSend(row)) {
    return {
      ok: true,
      skipped: true,
      message: "Already approved or not sendable.",
      id: row.id,
    };
  }
  const formData = new FormData();
  formData.set("id", row.id);
  formData.set("campaign_header_id", row.campaign_header_id);
  const result = await sendVendorIoAction({ ok: false }, formData);
  return { ...result, id: row.id };
}

export async function mutateVendorIoMarkAccepted(row: VendorIoRow) {
  if (row.status === "approved") {
    return {
      ok: true,
      skipped: true,
      message: "Already approved.",
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
  const formData = new FormData();
  formData.set("id", row.id);
  formData.set("campaign_header_id", row.campaign_header_id);
  const result = await recordVendorIoManualApprovalAction({ ok: false }, formData);
  return { ...result, id: row.id };
}

export async function mutateVendorIoSignedUrl(row: VendorIoRow, url: string) {
  const formData = new FormData();
  formData.set("id", row.id);
  formData.set("campaign_header_id", row.campaign_header_id);
  formData.set("attachment_url", url);
  const result = await updateVendorIoAttachmentUrlAction({ ok: false }, formData);
  return { ...result, id: row.id };
}

export async function mutateVendorIoPaymentTerms(row: VendorIoRow, terms: string) {
  const formData = new FormData();
  formData.set("id", row.id);
  formData.set("campaign_header_id", row.campaign_header_id);
  formData.set("special_payment_terms", terms);
  const result = await updateVendorIoSpecialPaymentTermsAction(
    { ok: false },
    formData
  );
  return { ...result, id: row.id };
}
