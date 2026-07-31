import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  clientIoAmendmentDocumentNumber,
  clientIoBaseDocumentNumber,
  formatClientIoAmendmentLabel,
  isClientIoAmendmentAllowed,
} from "./client-io-amendment";

test("clientIoBaseDocumentNumber strips /A suffix", () => {
  assert.equal(clientIoBaseDocumentNumber("CIO-2026-0001"), "CIO-2026-0001");
  assert.equal(clientIoBaseDocumentNumber("CIO-2026-0001/A1"), "CIO-2026-0001");
  assert.equal(clientIoBaseDocumentNumber("CIO-2026-0001/A12"), "CIO-2026-0001");
});

test("clientIoAmendmentDocumentNumber uses /A{n} kickoff numbering", () => {
  assert.equal(clientIoAmendmentDocumentNumber("CIO-2026-0001", 0), "CIO-2026-0001");
  assert.equal(clientIoAmendmentDocumentNumber("CIO-2026-0001", 1), "CIO-2026-0001/A1");
  assert.equal(clientIoAmendmentDocumentNumber("CIO-2026-0001/A1", 2), "CIO-2026-0001/A2");
});

test("amendment allowed only after send/review/approved and not superseded", () => {
  assert.equal(isClientIoAmendmentAllowed("draft"), false);
  assert.equal(isClientIoAmendmentAllowed("generated"), false);
  assert.equal(isClientIoAmendmentAllowed("sent"), true);
  assert.equal(isClientIoAmendmentAllowed("under_client_review"), true);
  assert.equal(isClientIoAmendmentAllowed("approved"), true);
  assert.equal(isClientIoAmendmentAllowed("rejected"), true);
  assert.equal(isClientIoAmendmentAllowed("approved", true), false);
});

test("formatClientIoAmendmentLabel", () => {
  assert.equal(formatClientIoAmendmentLabel(0), "Original");
  assert.equal(formatClientIoAmendmentLabel(1), "Amendment A1");
});
