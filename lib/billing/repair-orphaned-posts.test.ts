/**
 * Run: npx tsx lib/billing/repair-orphaned-posts.test.ts
 */
import { postScheduleNeedsOrphanRepair } from "@/lib/billing/repair-orphaned-invoice-state";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function basePost() {
  return {
    id: "post-1",
    campaign_line_id: "line-1",
    assignment_deliverable_id: "del-1",
    billing_status: "ready_to_invoice",
    invoice_line_item_id: null,
    locked_at: null,
    billable_amount: 500,
    revenue_before_vat: 500,
  };
}

function testFreshPostDoesNotNeedRepair() {
  assert(
    !postScheduleNeedsOrphanRepair(basePost(), new Set()),
    "ready_to_invoice post without locks should not repair"
  );
}

function testStaleLineItemNeedsRepair() {
  const row = {
    ...basePost(),
    billing_status: "invoiced",
    invoice_line_item_id: "ili-stale",
    locked_at: "2026-01-01",
  };
  assert(
    postScheduleNeedsOrphanRepair(row, new Set()),
    "stale invoice line item should need repair"
  );
}

function testLiveLineItemDoesNotNeedRepair() {
  const row = {
    ...basePost(),
    billing_status: "invoiced",
    invoice_line_item_id: "ili-live",
    locked_at: "2026-01-01",
  };
  assert(
    !postScheduleNeedsOrphanRepair(row, new Set(["ili-live"])),
    "live invoice line item should not repair"
  );
}

function testLockedWithoutLineItemNeedsRepair() {
  const row = {
    ...basePost(),
    locked_at: "2026-01-01",
  };
  assert(
    postScheduleNeedsOrphanRepair(row, new Set()),
    "locked post without line item should repair"
  );
}

testFreshPostDoesNotNeedRepair();
testStaleLineItemNeedsRepair();
testLiveLineItemDoesNotNeedRepair();
testLockedWithoutLineItemNeedsRepair();
console.log("repair-orphaned-posts.test.ts: ok");
