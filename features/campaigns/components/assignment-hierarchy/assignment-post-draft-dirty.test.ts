import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAssignmentPostDraftDirty } from "@/features/campaigns/components/assignment-hierarchy/assignment-post-draft-dirty";
import type { OperationalCommercialDraft } from "@/features/campaigns/components/assignment-hierarchy/use-operational-commercial-draft";

const commercial: OperationalCommercialDraft = {
  qty: 2,
  revPerAd: 1000,
  rev: 2000,
  costPerAd: 400,
  cost: 800,
};

const meta = {
  platform: "instagram",
  deliverable_type: "instagram_reel",
  live_date: "2026-08-01",
  revenue_vat_percent: 14,
  workflow_status: "draft",
  billing_status: "draft",
  notes: "",
};

describe("isAssignmentPostDraftDirty", () => {
  it("is clean when drafts match the baseline", () => {
    assert.equal(
      isAssignmentPostDraftDirty({
        commercial,
        baselineCommercial: commercial,
        meta,
        baselineMeta: meta,
        includeCommercial: true,
      }),
      false
    );
  });

  it("detects commercial edits", () => {
    assert.equal(
      isAssignmentPostDraftDirty({
        commercial: { ...commercial, qty: 3, rev: 3000, cost: 1200 },
        baselineCommercial: commercial,
        meta,
        baselineMeta: meta,
        includeCommercial: true,
      }),
      true
    );
  });

  it("ignores commercial edits when the row does not own them", () => {
    assert.equal(
      isAssignmentPostDraftDirty({
        commercial: { ...commercial, qty: 9 },
        baselineCommercial: commercial,
        meta,
        baselineMeta: meta,
        includeCommercial: false,
      }),
      false
    );
  });

  it("detects live date and workflow edits", () => {
    assert.equal(
      isAssignmentPostDraftDirty({
        commercial,
        baselineCommercial: commercial,
        meta: { ...meta, live_date: "2026-08-19", workflow_status: "posted" },
        baselineMeta: meta,
        includeCommercial: true,
      }),
      true
    );
  });
});
