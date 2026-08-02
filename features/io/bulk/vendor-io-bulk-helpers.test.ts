import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeVendorIoSendBulkLabel,
  exportVendorIoRowsCsv,
  vendorIoAlreadyAccepted,
  vendorIoAlreadySentOrDelivered,
  vendorIoIsManualDeliveryCandidate,
  vendorIoNeedsSend,
} from "@/features/io/bulk/vendor-io-bulk-helpers";
import type { VendorIoRow } from "@/features/io/types";

function row(overrides: Partial<VendorIoRow> = {}): VendorIoRow {
  return {
    id: "vio-1",
    campaign_header_id: "camp-1",
    assignment_id: "asg-1",
    campaign_name: "Campaign",
    campaign_document_number: "TW-2026-0001",
    assignment_document_number: "TW-2026-0001-A",
    document_number: "VIO-1",
    influencer_id: "inf-1",
    influencer_name: "Creator",
    influencer_email: null,
    creator_avatar_url: null,
    vendor_io_terms_text: null,
    amount: 1000,
    currency_code: "USD",
    status: "generated",
    delivery_method: null,
    delivery_status: null,
    delivery_error: null,
    delivered_at: null,
    delivery_recipient: null,
    ungenerate_eligible: false,
    ungenerate_ineligible_reason: null,
    terms_html: null,
    terms_text: null,
    usage_rights: null,
    exclusivity: null,
    attachment_url: null,
    generated_html_url: null,
    generated_pdf_url: null,
    document_generated_at: null,
    sent_at: null,
    approved_at: null,
    approved_by_name: null,
    rejection_reason: null,
    vendor_payment_terms: null,
    vendor_payment_terms_label: "Net 30",
    special_payment_terms: null,
    effective_payment_terms_label: "Net 30",
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("vendor IO bulk helpers", () => {
  it("labels all-manual selections as Mark Delivered Manually", () => {
    const rows = [row(), row({ id: "vio-2", influencer_email: " " })];
    assert.equal(describeVendorIoSendBulkLabel(rows), "Mark Delivered Manually");
    assert.equal(vendorIoIsManualDeliveryCandidate(rows[0]!), true);
  });

  it("labels mixed selections as Send / Mark Delivered", () => {
    const rows = [
      row({ influencer_email: "a@example.com" }),
      row({ id: "vio-2", influencer_email: null }),
    ];
    assert.equal(describeVendorIoSendBulkLabel(rows), "Send / Mark Delivered");
  });

  it("skips approved rows from send eligibility", () => {
    assert.equal(vendorIoNeedsSend(row({ status: "approved" })), false);
    assert.equal(vendorIoNeedsSend(row({ status: "generated" })), true);
  });

  it("is idempotent for already sent / delivered / accepted", () => {
    assert.equal(vendorIoAlreadyAccepted(row({ status: "approved" })), true);
    assert.equal(vendorIoAlreadySentOrDelivered(row({ status: "sent" })), true);
    assert.equal(
      vendorIoAlreadySentOrDelivered(
        row({
          status: "sent",
          delivery_method: "manual",
          delivery_status: "completed",
        })
      ),
      true
    );
    assert.equal(vendorIoNeedsSend(row({ status: "sent" })), false);
    assert.equal(vendorIoNeedsSend(row({ status: "cancelled" })), false);
    assert.equal(
      vendorIoNeedsSend(row({ status: "revision_required" })),
      false
    );
    assert.equal(vendorIoNeedsSend(row({ status: "generated" })), true);
  });

  it("exports selected rows as CSV without losing columns", () => {
    const csv = exportVendorIoRowsCsv([
      row({ document_number: "VIO-9", influencer_name: "Ada, Ops" }),
    ]);
    assert.match(csv, /document_number/);
    assert.match(csv, /"Ada, Ops"/);
    assert.match(csv, /VIO-9/);
  });
});
