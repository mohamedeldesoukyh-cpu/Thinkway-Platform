import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatVendorIoDeliveryLabel,
  hasValidVendorEmail,
} from "@/lib/io/vendor-io-delivery";
import { buildVendorIoEmailSubject } from "@/lib/email/vendor-io-email";

describe("vendor io delivery", () => {
  it("detects valid vendor emails", () => {
    assert.equal(hasValidVendorEmail("vendor@example.com"), true);
    assert.equal(hasValidVendorEmail("  "), false);
    assert.equal(hasValidVendorEmail("not-an-email"), false);
    assert.equal(hasValidVendorEmail(null), false);
  });

  it("formats delivery labels", () => {
    assert.equal(formatVendorIoDeliveryLabel("email", "sent"), "Email Sent");
    assert.equal(formatVendorIoDeliveryLabel("manual", "completed"), "Delivered Manually");
    assert.equal(formatVendorIoDeliveryLabel("email", "failed"), "Email Failed");
    assert.equal(formatVendorIoDeliveryLabel(null, null), null);
  });

  it("builds enterprise subject with document number", () => {
    assert.equal(
      buildVendorIoEmailSubject({ document_number: "VIO-2026-001" }),
      "Vendor IO VIO-2026-001 – Approval Required – Thinkway Media"
    );
  });
});
