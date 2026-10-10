import assert from "node:assert/strict";
import { test } from "node:test";

import {
  documentNumberDisplayTitle,
  documentNumberLookupCandidates,
  formatDocumentNumberForDisplay,
} from "@/lib/documents/format-document-number";

test("formatDocumentNumberForDisplay strips padded serial segments", () => {
  assert.equal(formatDocumentNumberForDisplay("TW-2026-0001"), "Camp#26-1");
  assert.equal(formatDocumentNumberForDisplay("TW-2026-0001-A"), "Camp#26-1-A");
  assert.equal(formatDocumentNumberForDisplay("INF-000002"), "INF-2");
});

test("documentNumberLookupCandidates includes Camp# display → TW storage pads", () => {
  const candidates = documentNumberLookupCandidates("Camp#26-1");
  assert.ok(candidates.includes("Camp#26-1"));
  assert.ok(candidates.includes("TW-2026-1"));
  assert.ok(candidates.includes("TW-2026-0001"));
});

test("documentNumberLookupCandidates includes common zero-padded storage forms", () => {
  assert.deepEqual(documentNumberLookupCandidates("INF-10483"), [
    "INF-10483",
    "INF-010483",
    "INF-0010483",
    "INF-00010483",
  ]);
  assert.ok(documentNumberLookupCandidates("INF-CI-RLS-1").includes("INF-CI-RLS-000001"));
});

test("formatDocumentNumberForDisplay strips padded vendor IO revision numbers", () => {
  assert.equal(formatDocumentNumberForDisplay("VIO-2026-0006/2"), "VIO-26-6/2");
  assert.equal(formatDocumentNumberForDisplay("VIO-2026-0001/1"), "VIO-26-1/1");
  assert.equal(formatDocumentNumberForDisplay("VIO-2026-0001"), "VIO-26-1");
});

test("documentNumberDisplayTitle returns canonical when display differs", () => {
  assert.equal(documentNumberDisplayTitle("VIO-2026-0006/2"), "VIO-2026-0006/2");
  assert.equal(documentNumberDisplayTitle("VIO-26-6/2"), undefined);
  assert.equal(documentNumberDisplayTitle("TW-2026-0001"), "TW-2026-0001");
});

test("compact quotation and shortlist references preserve versions and resolve canonical IDs", () => {
  assert.equal(formatDocumentNumberForDisplay("QT-2026-0031"), "QT-26-31");
  assert.equal(formatDocumentNumberForDisplay("QT-2026-0029-V2"), "QT-26-29-V2");
  assert.equal(formatDocumentNumberForDisplay("SL-2026-0003"), "SL-26-3");
  assert.ok(documentNumberLookupCandidates("QT-26-29-V2").includes("QT-2026-0029-V2"));
  assert.ok(documentNumberLookupCandidates("QT-26-31").includes("QT-2026-0031"));
  assert.equal(formatDocumentNumberForDisplay("INF-00012345678901234567890"), "INF-12345678901234567890");
});
