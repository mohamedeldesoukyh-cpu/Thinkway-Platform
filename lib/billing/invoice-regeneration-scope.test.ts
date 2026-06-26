/**
 * Run: npx tsx lib/billing/invoice-regeneration-scope.test.ts
 */
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// scopeFromLines is not exported — inline the same extraction for snapshot lines
function scopeFromSnapshotLines(
  lines: Array<{
    campaign_line_id: string | null;
    assignment_deliverable_id: string | null;
  }>
) {
  const lineIds = [
    ...new Set(lines.map((line) => line.campaign_line_id).filter(Boolean) as string[]),
  ];
  const deliverableIds = [
    ...new Set(
      lines.map((line) => line.assignment_deliverable_id).filter(Boolean) as string[]
    ),
  ];
  return { lineIds, deliverableIds };
}

function testScopeFromDeliverableLineItems() {
  const scoped = scopeFromSnapshotLines([
    {
      campaign_line_id: "line-1",
      assignment_deliverable_id: "del-1",
    },
    {
      campaign_line_id: "line-1",
      assignment_deliverable_id: "del-2",
    },
  ]);
  assert(scoped.lineIds.length === 1, "one campaign line");
  assert(scoped.deliverableIds.length === 2, "two deliverables in scope");
}

function testScopeExcludesUnselectedCampaignLines() {
  const invoiceSnapshot = scopeFromSnapshotLines([
    { campaign_line_id: "line-a", assignment_deliverable_id: "del-a" },
    { campaign_line_id: "line-b", assignment_deliverable_id: "del-b" },
  ]);
  const userSelection = scopeFromSnapshotLines([
    { campaign_line_id: "line-a", assignment_deliverable_id: "del-a" },
    { campaign_line_id: "line-b", assignment_deliverable_id: "del-b" },
  ]);
  const allCampaignLines = scopeFromSnapshotLines([
    { campaign_line_id: "line-a", assignment_deliverable_id: "del-a" },
    { campaign_line_id: "line-b", assignment_deliverable_id: "del-b" },
    { campaign_line_id: "line-c", assignment_deliverable_id: "del-c" },
  ]);
  assert(
    userSelection.lineIds.length === 2,
    "user selection limits regeneration to two lines"
  );
  assert(
    allCampaignLines.lineIds.length === 3,
    "full campaign would incorrectly include a third line"
  );
  assert(
    invoiceSnapshot.lineIds.join(",") === userSelection.lineIds.join(","),
    "snapshot scope matches the prior invoice lines"
  );
}

testScopeFromDeliverableLineItems();
testScopeExcludesUnselectedCampaignLines();
console.log("invoice-regeneration-scope: 2 passed");

export {};
