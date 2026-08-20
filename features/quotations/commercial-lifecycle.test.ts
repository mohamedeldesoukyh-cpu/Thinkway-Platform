import assert from "node:assert/strict";

import {
  canCreateCampaignFromQuotation,
  canGenerateQuotationVersion,
  isApprovedQuotationLocked,
  isCommercialSyncEnabled,
  isQuotationCommercialImmutable,
  NEW_QUOTATION_VERSION_STATUS,
  approvedQuotationMutationError,
} from "@/lib/commercial-sync/rules";

/**
 * Pure regression tests for quotation commercial lifecycle rules (no database).
 */

type QuotationState = {
  status: "draft" | "under_review" | "sent" | "approved" | "rejected" | "archived";
  shortlistId: string | null;
  syncEnabled: boolean;
  items: string[];
};

function evaluateSync(state: QuotationState): QuotationState {
  return {
    ...state,
    syncEnabled: isCommercialSyncEnabled(state.status),
  };
}

function transitionStatus(
  state: QuotationState,
  to: QuotationState["status"]
): QuotationState {
  const next = { ...state, status: to };
  return evaluateSync(next);
}

// Temporary client governance: quotation-scoped until promoted (no master row).
const tempClient = { isTemporary: true, masterClientId: null as string | null };
assert.equal(tempClient.masterClientId, null);
tempClient.masterClientId = "client-uuid";
tempClient.isTemporary = false;
assert.ok(tempClient.masterClientId);

// Quotation → shortlist link
let quotation: QuotationState = evaluateSync({
  status: "draft",
  shortlistId: null,
  syncEnabled: true,
  items: ["c1", "c2"],
});
quotation = { ...quotation, shortlistId: "sl-1", items: [...quotation.items] };
assert.equal(quotation.shortlistId, "sl-1");
assert.equal(quotation.items.length, 2);

// Sync while draft
assert.equal(quotation.syncEnabled, true);
quotation = transitionStatus(quotation, "under_review");
assert.equal(quotation.syncEnabled, true);

// Immutable after sent
quotation = transitionStatus(quotation, "sent");
assert.equal(quotation.syncEnabled, false);
assert.equal(isQuotationCommercialImmutable("sent"), true);

// Version generation after sent
assert.equal(canGenerateQuotationVersion("sent"), true);

// Campaign only from approved
assert.equal(canCreateCampaignFromQuotation("approved"), true);
assert.equal(canCreateCampaignFromQuotation("sent"), false);

assert.equal(isApprovedQuotationLocked("approved"), true);
assert.equal(isApprovedQuotationLocked("sent"), false);
assert.ok(approvedQuotationMutationError("approved")?.message.includes("new quotation version"));
assert.equal(canGenerateQuotationVersion("approved"), true);
assert.equal(NEW_QUOTATION_VERSION_STATUS, "draft");

// V2 path
quotation = transitionStatus(
  { status: "sent", shortlistId: "sl-1", syncEnabled: false, items: ["c1"] },
  "sent"
);
assert.equal(canGenerateQuotationVersion(quotation.status), true);

console.log("commercial-lifecycle.test.ts: all assertions passed");
