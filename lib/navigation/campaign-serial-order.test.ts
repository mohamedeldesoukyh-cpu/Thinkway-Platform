import assert from "node:assert/strict";
import test from "node:test";
import { sortCampaignsBySerial } from "./campaign-serial-order";

test("navigation follows numerical serials across years, not newest-first input", () => {
  const rows = ["TW-2026-10", "TW-2026-9", "TW-2026-8", "TW-2026-7", "TW-2025-99"]
    .map((document_number) => ({ id: document_number, document_number }));
  const sorted = sortCampaignsBySerial(rows);
  assert.deepEqual(sorted.map((row) => row.id), ["TW-2025-99", "TW-2026-7", "TW-2026-8", "TW-2026-9", "TW-2026-10"]);
  assert.equal(rows[0].id, "TW-2026-10");
});

test("missing serials are placed after numbered campaigns", () => {
  assert.deepEqual(sortCampaignsBySerial([
    { id: "missing", document_number: null }, { id: "seven", document_number: "TW-2026-0007" },
  ]).map((row) => row.id), ["seven", "missing"]);
});
