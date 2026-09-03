/**
 * Run: npx tsx lib/billing/invoice-existing-target.test.ts
 */
import assert from "node:assert/strict";

import {
  existingInvoiceTargetMode,
  findLivePendingRegenerationInvoice,
  isInvoiceExistingTarget,
  isInvoiceRegeneratableTarget,
  isLivePendingRegenerationInvoice,
  pendingInvoiceOverlapsReplacement,
} from "@/lib/billing/invoice-existing-target";
import { getInvoiceOperationalState } from "@/lib/finance/invoice-registry";
import { getInvoiceRegisterStatusLabel } from "@/lib/finance/status/invoice-status";

const sharedTarget = {
  currency: "EGP",
  client_id: "cl-1",
  campaign_header_id: "camp-1",
  target_currency: "EGP",
  target_client_id: "cl-1",
  target_campaign_id: "camp-1",
};

function testLivePendingIgnoresVoid() {
  assert.equal(
    isLivePendingRegenerationInvoice({
      status: "draft",
      regeneration_status: "pending_regeneration",
    }),
    true
  );
  assert.equal(
    isLivePendingRegenerationInvoice({
      status: "void",
      regeneration_status: "pending_regeneration",
    }),
    false,
    "void invoices must not stay pending"
  );
  assert.equal(
    findLivePendingRegenerationInvoice([
      { id: "old", status: "void", regeneration_status: "pending_regeneration" },
      { id: "live", status: "draft", regeneration_status: "active" },
    ])?.id,
    undefined
  );
}

function testExistingTargetOffersPendingAndOpenDrafts() {
  assert.equal(
    isInvoiceRegeneratableTarget({
      ...sharedTarget,
      status: "draft",
      regeneration_status: "pending_regeneration",
      is_operational_locked: false,
    }),
    true
  );
  assert.equal(
    isInvoiceExistingTarget({
      ...sharedTarget,
      status: "draft",
      regeneration_status: "pending_regeneration",
      is_operational_locked: false,
    }),
    true,
    "confirm dialog must offer the ungenerated invoice"
  );
  assert.equal(
    isInvoiceExistingTarget({
      ...sharedTarget,
      status: "draft",
      regeneration_status: "active",
      is_operational_locked: false,
    }),
    true
  );
  assert.equal(
    existingInvoiceTargetMode({
      status: "draft",
      regeneration_status: "pending_regeneration",
    }),
    "regenerate"
  );
  assert.equal(
    existingInvoiceTargetMode({
      status: "draft",
      regeneration_status: "active",
    }),
    "append"
  );
}

function testReplacementCancelsOverlappingPendingOnly() {
  assert.equal(
    pendingInvoiceOverlapsReplacement({
      pendingInvoiceId: "inv-old",
      replacementInvoiceId: "inv-new",
      pendingLineIds: ["line-a"],
      touchedLineIds: ["line-a"],
    }),
    true
  );
  assert.equal(
    pendingInvoiceOverlapsReplacement({
      pendingInvoiceId: "inv-old",
      replacementInvoiceId: "inv-new",
      pendingLineIds: ["line-b"],
      touchedLineIds: ["line-a"],
    }),
    false,
    "do not cancel a pending invoice for a different assignment"
  );
  assert.equal(
    pendingInvoiceOverlapsReplacement({
      pendingInvoiceId: "inv-old",
      replacementInvoiceId: "inv-old",
      pendingLineIds: ["line-a"],
      touchedLineIds: ["line-a"],
    }),
    false,
    "never cancel the invoice being regenerated"
  );
  assert.equal(
    pendingInvoiceOverlapsReplacement({
      pendingInvoiceId: "inv-old",
      replacementInvoiceId: "inv-new",
      pendingLineIds: [],
      touchedLineIds: ["line-a"],
    }),
    true,
    "campaign-level pending with no leftover items is replaced"
  );
}

function testCancelledDisplayNotPending() {
  assert.equal(
    getInvoiceRegisterStatusLabel({ status: "void" }),
    "Cancelled"
  );
  assert.equal(
    getInvoiceRegisterStatusLabel({
      status: "void",
      regeneration_status: "pending_regeneration",
    }),
    "Cancelled"
  );
  assert.equal(
    getInvoiceOperationalState({
      status: "void",
      regeneration_status: "pending_regeneration",
      is_operational_locked: false,
    }).locked_status,
    "Open",
    "cancelled invoices must not show Pending regeneration"
  );
}

const tests = [
  testLivePendingIgnoresVoid,
  testExistingTargetOffersPendingAndOpenDrafts,
  testReplacementCancelsOverlappingPendingOnly,
  testCancelledDisplayNotPending,
];

for (const run of tests) {
  run();
}

console.log(`invoice-existing-target: ${tests.length} passed`);
