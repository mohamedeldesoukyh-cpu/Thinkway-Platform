import assert from "node:assert/strict";

import {
  canCreateCampaignFromQuotation,
  canGenerateQuotationVersion,
  formatVersionedQuotationSerial,
  isCommercialSyncEnabled,
  isQuotationCommercialImmutable,
  stripQuotationVersionSuffix,
} from "@/lib/commercial-sync/rules";

assert.equal(isCommercialSyncEnabled("draft"), true);
assert.equal(isCommercialSyncEnabled("under_review"), true);
assert.equal(isCommercialSyncEnabled("sent"), false);
assert.equal(isCommercialSyncEnabled("approved"), false);

assert.equal(isQuotationCommercialImmutable("sent"), true);
assert.equal(isQuotationCommercialImmutable("approved"), true);
assert.equal(isQuotationCommercialImmutable("rejected"), true);
assert.equal(isQuotationCommercialImmutable("archived"), true);
assert.equal(isQuotationCommercialImmutable("draft"), false);

assert.equal(canGenerateQuotationVersion("draft"), false);
assert.equal(canGenerateQuotationVersion("sent"), true);
assert.equal(canGenerateQuotationVersion("approved"), true);

assert.equal(canCreateCampaignFromQuotation("approved"), true);
assert.equal(canCreateCampaignFromQuotation("sent"), false);

assert.equal(stripQuotationVersionSuffix("QT-2026-0001-V2"), "QT-2026-0001");
assert.equal(formatVersionedQuotationSerial("QT-2026-0001", 1), "QT-2026-0001");
assert.equal(formatVersionedQuotationSerial("QT-2026-0001", 2), "QT-2026-0001-V2");
assert.equal(formatVersionedQuotationSerial("QT-2026-0001-V2", 3), "QT-2026-0001-V3");

console.log("commercial-sync rules.test.ts: all assertions passed");
