import assert from "node:assert/strict";
import { test } from "node:test";

import {
  documentNumberDisplayTitle,
  formatDocumentNumberForDisplay,
} from "@/lib/documents/format-document-number";

test("formatDocumentNumberForDisplay strips padded serial segments", () => {
  assert.equal(formatDocumentNumberForDisplay("TW-2026-0001"), "TW-2026-1");
  assert.equal(formatDocumentNumberForDisplay("TW-2026-0001-A"), "TW-2026-1-A");
  assert.equal(formatDocumentNumberForDisplay("INF-000002"), "INF-2");
});

test("formatDocumentNumberForDisplay strips padded vendor IO revision numbers", () => {
  assert.equal(formatDocumentNumberForDisplay("VIO-2026-0006/2"), "VIO-2026-6/2");
  assert.equal(formatDocumentNumberForDisplay("VIO-2026-0001/1"), "VIO-2026-1/1");
  assert.equal(formatDocumentNumberForDisplay("VIO-2026-0001"), "VIO-2026-1");
});

test("documentNumberDisplayTitle returns canonical when display differs", () => {
  assert.equal(documentNumberDisplayTitle("VIO-2026-0006/2"), "VIO-2026-0006/2");
  assert.equal(documentNumberDisplayTitle("VIO-2026-6/2"), undefined);
});
