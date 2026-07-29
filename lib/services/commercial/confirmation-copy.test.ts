import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  commercialSyncConfirmationCopy,
  financeLockConfirmationCopy,
} from "./confirmation-copy";

describe("Commercial SSOT confirmation copy", () => {
  it("uses normative Campaign → Quotation wording with serial", () => {
    const copy = commercialSyncConfirmationCopy({
      side: "campaign",
      quotationSerial: "Q-2026-0042",
      campaignDocumentNumber: "TW-2026-0001",
    });
    assert.match(copy.description, /Quotation Q-2026-0042/);
    assert.match(copy.description, /both the Quotation and the Campaign/);
    assert.match(copy.description, /Do you want to continue/);
  });

  it("uses normative Quotation → Campaign wording", () => {
    const copy = commercialSyncConfirmationCopy({
      side: "quotation",
      quotationSerial: "Q-1",
      campaignDocumentNumber: "TW-2026-0009",
    });
    assert.match(copy.description, /Campaign TW-2026-0009/);
    assert.match(copy.description, /both the Quotation and the Campaign/);
  });

  it("finance lock copy matches Phase 3 normative message", () => {
    const copy = financeLockConfirmationCopy();
    assert.match(copy.description, /finance process/);
    assert.match(copy.description, /Commercial Revision/);
  });
});
