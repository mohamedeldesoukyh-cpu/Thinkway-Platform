import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  isClientIoComposerEditable,
  isClientIoRegenerateAllowed,
} from "./client-io-assignments";
import {
  buildClientIoAssignmentSnapshot,
  filterLinesBySelectedIds,
  isClientIoAssignmentSnapshotV1,
} from "./client-io-assignment-snapshot";

test("composer editable only for draft/generated", () => {
  assert.equal(isClientIoComposerEditable("draft"), true);
  assert.equal(isClientIoComposerEditable("generated"), true);
  assert.equal(isClientIoComposerEditable("sent"), false);
  assert.equal(isClientIoComposerEditable("under_client_review"), false);
  assert.equal(isClientIoComposerEditable("approved"), false);
});

test("regenerate allowed only pre-send", () => {
  assert.equal(isClientIoRegenerateAllowed("draft"), true);
  assert.equal(isClientIoRegenerateAllowed("generated"), true);
  assert.equal(isClientIoRegenerateAllowed("sent"), false);
  assert.equal(isClientIoRegenerateAllowed("under_client_review"), false);
});

test("filterLinesBySelectedIds returns empty when none selected", () => {
  const lines = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(filterLinesBySelectedIds(lines, []), []);
  assert.deepEqual(
    filterLinesBySelectedIds(lines, ["b"]).map((row) => row.id),
    ["b"]
  );
});

test("buildClientIoAssignmentSnapshot keeps only selected lines + deliverables", () => {
  const snapshot = buildClientIoAssignmentSnapshot({
    capturedAt: "2026-07-31T00:00:00.000Z",
    selectedCampaignLineIds: ["line-1"],
    lines: [
      {
        id: "line-1",
        document_number: "TW-2026-0001-A",
        name: "Creator A",
        description: "1x IG Reel",
        metadata: null,
        revenue_before_vat: 1000,
        revenue: 1000,
        usage_rights_amount: 0,
        agency_fee_amount: 0,
        agency_fee_percent: 0,
        revenue_vat_percent: 14,
        revenue_vat_exempt: false,
        currency_code: "EGP",
        sort_order: 1,
      },
      {
        id: "line-2",
        document_number: "TW-2026-0001-B",
        name: "Creator B",
        description: null,
        metadata: null,
        revenue_before_vat: 500,
        revenue: 500,
        usage_rights_amount: 0,
        agency_fee_amount: 0,
        agency_fee_percent: 0,
        revenue_vat_percent: 14,
        revenue_vat_exempt: false,
        currency_code: "EGP",
        sort_order: 2,
      },
    ],
    deliverables: [
      {
        platform: "instagram",
        deliverable_type: "reel",
        quantity: 1,
        live_date: "2026-08-01",
        campaign_line_id: "line-1",
        sort_order: 1,
      },
      {
        platform: "tiktok",
        deliverable_type: "video",
        quantity: 1,
        live_date: "2026-08-02",
        campaign_line_id: "line-2",
        sort_order: 1,
      },
    ],
  });

  assert.equal(isClientIoAssignmentSnapshotV1(snapshot), true);
  assert.deepEqual(snapshot.selectedCampaignLineIds, ["line-1"]);
  assert.equal(snapshot.lines.length, 1);
  assert.equal(snapshot.lines[0]?.id, "line-1");
  assert.equal(snapshot.deliverables.length, 1);
  assert.equal(snapshot.deliverables[0]?.campaign_line_id, "line-1");
});
