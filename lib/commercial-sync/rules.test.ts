import assert from "node:assert/strict";

import {
  canCreateCampaignFromQuotation,
  canGenerateQuotationVersion,
  formatVersionedQuotationSerial,
  isApprovedQuotationCommercialHeaderPatch,
  isApprovedQuotationLocked,
  isCommercialSyncEnabled,
  isQuotationCommercialImmutable,
  approvedQuotationMutationError,
  NEW_QUOTATION_VERSION_STATUS,
  stripQuotationVersionSuffix,
  APPROVED_QUOTATION_LOCKED_MESSAGE,
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

assert.equal(isApprovedQuotationLocked("approved"), true);
assert.equal(isApprovedQuotationLocked("sent"), false);
assert.equal(isApprovedQuotationLocked("draft"), false);
assert.equal(isApprovedQuotationLocked("under_review"), false);
assert.equal(approvedQuotationMutationError("approved")?.message, APPROVED_QUOTATION_LOCKED_MESSAGE);
assert.equal(approvedQuotationMutationError("sent"), null);
assert.equal(approvedQuotationMutationError("draft"), null);
assert.equal(NEW_QUOTATION_VERSION_STATUS, "draft");
assert.equal(isApprovedQuotationCommercialHeaderPatch({ currency: "USD" }), true);
assert.equal(isApprovedQuotationCommercialHeaderPatch({ status: "draft" }), true);
assert.equal(isApprovedQuotationCommercialHeaderPatch({ status: "approved" }), false);
assert.equal(isApprovedQuotationCommercialHeaderPatch({ notes: "ok" }), false);
assert.equal(isApprovedQuotationCommercialHeaderPatch({ total_revenue_egp: 1 }), true);

assert.equal(canCreateCampaignFromQuotation("approved"), true);
assert.equal(canCreateCampaignFromQuotation("sent"), false);

assert.equal(stripQuotationVersionSuffix("QT-2026-0001-V2"), "QT-2026-0001");
assert.equal(formatVersionedQuotationSerial("QT-2026-0001", 1), "QT-2026-0001");
assert.equal(formatVersionedQuotationSerial("QT-2026-0001", 2), "QT-2026-0001-V2");
assert.equal(formatVersionedQuotationSerial("QT-2026-0001-V2", 3), "QT-2026-0001-V3");

console.log("commercial-sync rules.test.ts: all assertions passed");
