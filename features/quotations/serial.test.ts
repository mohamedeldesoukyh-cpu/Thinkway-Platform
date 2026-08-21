import assert from "node:assert/strict";

import {
  collidesWithOtherSerial,
  isValidQuotationSerial,
  nextQuotationSequenceValue,
  parseQuotationBaseSequence,
  parseQuotationSerialYear,
  quotationSerialPrefix,
} from "@/features/quotations/serial";

assert.equal(quotationSerialPrefix(2026), "QT-2026");

assert.equal(isValidQuotationSerial("QT-2026-0001"), true);
assert.equal(isValidQuotationSerial("QT-2026-1234"), true);
assert.equal(isValidQuotationSerial("QT-2026-001"), false, "needs 4-digit pad");
assert.equal(isValidQuotationSerial("TW-2026-0001"), false, "campaign serial");
assert.equal(isValidQuotationSerial("SL-2026-0001"), false, "shortlist serial");
assert.equal(isValidQuotationSerial(""), false);
assert.equal(isValidQuotationSerial(null), false);

assert.equal(parseQuotationSerialYear("QT-2026-0007"), 2026);
assert.equal(parseQuotationSerialYear("nope"), null);

assert.equal(parseQuotationBaseSequence("QT-2026-0020"), 20);
assert.equal(parseQuotationBaseSequence("QT-2026-0018-V3"), null);
assert.equal(
  nextQuotationSequenceValue(18, ["QT-2026-0018", "QT-2026-0020", "QT-2026-0018-V3"]),
  21,
  "allocator must skip existing base serials even when last_value was rewound"
);

// Must never collide with campaign / shortlist serial spaces.
assert.equal(collidesWithOtherSerial("QT-2026-0001"), false);
assert.equal(collidesWithOtherSerial("TW-2026-0001"), true);
assert.equal(collidesWithOtherSerial("SL-2026-0001"), true);

console.log("quotation serial.test.ts: all assertions passed");
