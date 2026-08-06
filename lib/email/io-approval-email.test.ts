import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildClientIoEmailHtml,
  buildClientIoEmailPlainText,
  buildClientIoEmailSubject,
} from "@/lib/email/client-io-email";
import {
  buildIoApprovalConfirmationHtml,
  buildIoApprovalConfirmationSubject,
  TRAFFIC_OPERATIONS_EMAIL,
} from "@/lib/email/io-approval-emails";
import {
  formatIoAgreedAmount,
  formatIoCampaignDuration,
  sumClientIoComposerAgreedAmount,
  sumClientIoSnapshotAgreedAmount,
} from "@/lib/email/io-email-summary";
import { renderEmailApprovalCta } from "@/lib/email/layout";
import {
  buildVendorIoEmailHtml,
  buildVendorIoEmailPlainText,
} from "@/lib/email/vendor-io-email";

describe("io approval email experience", () => {
  it("formats campaign duration and agreed amount", () => {
    assert.equal(
      formatIoCampaignDuration("2026-07-01", "2026-07-31"),
      "01 Jul 2026 – 31 Jul 2026"
    );
    assert.match(formatIoAgreedAmount(1500, "USD"), /1,500/);
    assert.equal(formatIoAgreedAmount(null, "EGP"), "—");
    assert.equal(formatIoAgreedAmount(undefined, "EGP"), "—");
  });

  it("sums selected composer assignments for draft email preview", () => {
    const sum = sumClientIoComposerAgreedAmount(
      [
        { id: "a", revenue_before_vat: 10000, currency_code: "EGP" },
        { id: "b", revenue_before_vat: 8448, currency_code: "EGP" },
        { id: "c", revenue_before_vat: 999, currency_code: "EGP" },
      ],
      ["a", "b"],
      "USD"
    );
    // Campaign/workspace currency wins over stale line codes.
    assert.deepEqual(sum, { amount: 18448, currencyCode: "USD" });
  });

  it("sums Client IO snapshot revenue as agreed amount", () => {
    const sum = sumClientIoSnapshotAgreedAmount({
      version: 1,
      capturedAt: "2026-07-01T00:00:00.000Z",
      selectedCampaignLineIds: ["a", "b"],
      lines: [
        {
          id: "a",
          document_number: "L1",
          name: "Line A",
          metadata: null,
          revenue_before_vat: 1000,
          revenue: 1000,
          usage_rights_amount: null,
          agency_fee_amount: null,
          agency_fee_percent: null,
          revenue_vat_percent: null,
          revenue_vat_exempt: null,
          currency_code: "USD",
          sort_order: 1,
        },
        {
          id: "b",
          document_number: "L2",
          name: "Line B",
          metadata: null,
          revenue_before_vat: 500,
          revenue: 500,
          usage_rights_amount: null,
          agency_fee_amount: null,
          agency_fee_percent: null,
          revenue_vat_percent: null,
          revenue_vat_exempt: null,
          currency_code: "USD",
          sort_order: 2,
        },
      ],
      deliverables: [],
    });
    assert.deepEqual(sum, { amount: 1500, currencyCode: "USD" });
  });

  it("renders blue Approve CTA with legal notice", () => {
    const html = renderEmailApprovalCta(
      "https://app.example/io-approval/client?token=abc",
      "Approve Client IO"
    );
    assert.match(html, /background:#0057FF/);
    assert.match(html, /Approve Client IO/);
    assert.match(html, /href="https:\/\/app\.example\/io-approval\/client\?token=abc"/);
    assert.match(html, /Or open this link if the button is not clickable/);
    assert.match(html, /electronic approval will be securely recorded/);
  });

  it("keeps Client IO send email to essential fields only", () => {
    const io = {
      campaign_name: "Summer Launch",
      brand_name: "Acme",
      campaign_start_date: "2026-07-01",
      campaign_end_date: "2026-07-31",
      agreed_amount: 2500,
      currency_code: "USD",
      document_number: "CIO-2026-0001",
    };
    const html = buildClientIoEmailHtml({
      io,
      senderName: "Traffic",
      approvalUrl: "https://example.com/approve",
    });
    const text = buildClientIoEmailPlainText({
      io,
      senderName: "Traffic",
      approvalUrl: "https://example.com/approve",
    });

    assert.match(html, /Campaign Name/);
    assert.match(html, /Brand Name/);
    assert.match(html, /Campaign Duration/);
    assert.match(html, /Agreed Amount/);
    assert.match(html, /Approve Client IO/);
    assert.doesNotMatch(html, /deliverable/i);
    assert.doesNotMatch(html, /payment schedule/i);
    assert.doesNotMatch(html, /deemed-acceptance/i);
    assert.match(text, /Campaign Name: Summer Launch/);
    assert.equal(
      buildClientIoEmailSubject({
        document_number: "CIO-2026-0001",
        campaign_name: "Summer Launch",
      }),
      "Client Insertion Order — CIO-2026-0001 — Summer Launch"
    );
  });

  it("keeps Vendor IO send email to essential fields only", () => {
    const io = {
      document_number: "VIO-2026-0001",
      campaign_name: "Summer Launch",
      brand_name: "Acme",
      influencer_name: "Creator One",
      amount: 900,
      currency_code: "USD",
      campaign_start_date: "2026-07-01",
      campaign_end_date: "2026-07-31",
    };
    const html = buildVendorIoEmailHtml({
      io,
      senderName: "Traffic",
      approvalUrl: "https://example.com/approve",
      hasPdfAttachment: true,
    });
    const text = buildVendorIoEmailPlainText({
      io,
      senderName: "Traffic",
      approvalUrl: "https://example.com/approve",
      hasPdfAttachment: true,
    });

    assert.match(html, /Approve Vendor IO/);
    assert.match(html, /Brand Name/);
    assert.doesNotMatch(html, /Issue date/);
    assert.doesNotMatch(html, /Currency/);
    assert.match(text, /Agreed Amount:/);
  });

  it("builds confirmation subject and thanks the approver", () => {
    assert.equal(
      buildIoApprovalConfirmationSubject({
        kind: "client",
        documentNumber: "CIO-2026-0001",
      }),
      "Client IO CIO-2026-0001 – Approval Confirmed – Thinkway Media"
    );
    const html = buildIoApprovalConfirmationHtml({
      kind: "vendor",
      documentNumber: "VIO-2026-0001",
      approvedAt: "2026-07-27T10:00:00.000Z",
      recipientName: "Creator One",
    });
    assert.match(html, /Thank you/);
    assert.match(html, /Document Reference/);
    assert.match(html, /Approval Date &amp; Time|Approval Date & Time/);
    assert.equal(TRAFFIC_OPERATIONS_EMAIL, "traffic@thinkwaymedia.com");
  });
});
