import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWorkspaceGuidance,
  deriveLifecycleForTest,
} from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { CampaignProcessSignals } from "@/features/campaigns/lifecycle/campaign-process-presentation";

function base(overrides: Partial<CampaignProcessSignals> = {}): CampaignProcessSignals {
  return {
    status: "active",
    lineCount: 0,
    hasClientIo: false,
    clientIoStatus: null,
    vendorIoCount: 0,
    approvedVendorIoCount: 0,
    sentVendorIoCount: 0,
    deliverableCount: 0,
    uploadedDeliverableCount: 0,
    overdueDeliverableCount: 0,
    activePerformance: false,
    publicationCount: 0,
    invoiceCount: 0,
    billingOutstanding: 0,
    fullyInvoiced: false,
    blockerCount: 0,
    poExceeded: false,
    ...overrides,
  };
}

describe("campaign lifecycle orchestrator", () => {
  it("maps waiting client cue to Waiting Client business state", () => {
    const lifecycle = deriveLifecycleForTest(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "under_client_review",
      })
    );
    assert.equal(lifecycle.businessStageId, "client-io");
    assert.equal(lifecycle.businessState, "waiting");
    assert.equal(lifecycle.businessStateLabel, "Waiting Client");
    assert.ok(lifecycle.missing.some((item) => /client approval/i.test(item)));
    assert.equal(lifecycle.blockers.length, 0);
    assert.ok(lifecycle.requirements.some((item) => item.id === "cio_approved" && !item.met));
    assert.equal(lifecycle.owner, "Commercial");
    assert.equal(lifecycle.policy.enforcement, "soft");
    assert.equal(lifecycle.policy.mandatory, true);
  });

  it("uses Needs Attention instead of Blocked when enforcement is soft", () => {
    const lifecycle = deriveLifecycleForTest(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "rejected",
        blockerCount: 1,
      })
    );
    assert.equal(lifecycle.businessState, "needs_attention");
    assert.equal(lifecycle.businessStateLabel, "Needs Attention");
    assert.equal(lifecycle.blockers.length, 0);
    assert.ok(lifecycle.reason.length > 0);
    assert.ok(lifecycle.nextAction.length > 0);
  });

  it("builds dimensional health and readiness", () => {
    const lifecycle = deriveLifecycleForTest(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 1,
        approvedVendorIoCount: 1,
        sentVendorIoCount: 1,
      })
    );
    assert.ok(lifecycle.health.some((slice) => slice.id === "commercial"));
    assert.ok(lifecycle.health.some((slice) => slice.id === "operations"));
    assert.ok(lifecycle.health.some((slice) => slice.id === "performance"));
    assert.ok(lifecycle.health.some((slice) => slice.id === "finance"));
    assert.ok(lifecycle.readiness.some((item) => item.id === "assignments"));
    assert.ok(lifecycle.timeline.some((event) => event.id === "created"));
  });

  it("STAB-032: Campaign Closed stays Upcoming until invoices are settled", () => {
    const unpaid = deriveLifecycleForTest(
      base({
        status: "completed",
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 1,
        approvedVendorIoCount: 1,
        invoiceCount: 1,
        billingOutstanding: 760000,
        fullyInvoiced: true,
      })
    );
    const closedUnpaid = unpaid.timeline.find((e) => e.id === "campaign_closed");
    const paidUnpaid = unpaid.timeline.find((e) => e.id === "invoice_paid");
    assert.equal(closedUnpaid?.occurred, false);
    assert.equal(paidUnpaid?.occurred, false);

    const settled = deriveLifecycleForTest(
      base({
        status: "completed",
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 1,
        approvedVendorIoCount: 1,
        invoiceCount: 1,
        billingOutstanding: 0,
        fullyInvoiced: true,
      })
    );
    assert.equal(
      settled.timeline.find((e) => e.id === "invoice_paid")?.occurred,
      true
    );
    assert.equal(
      settled.timeline.find((e) => e.id === "campaign_closed")?.occurred,
      true
    );
  });

  it("STAB-035: Invoice Paid stays Upcoming while unbilled lines remain", () => {
    const partial = deriveLifecycleForTest(
      base({
        status: "active",
        lineCount: 10,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 10,
        approvedVendorIoCount: 10,
        invoiceCount: 1,
        billingOutstanding: 0,
        fullyInvoiced: false,
        publicationCount: 1,
        activePerformance: true,
        uploadedDeliverableCount: 10,
        deliverableCount: 10,
      })
    );
    assert.equal(
      partial.timeline.find((e) => e.id === "invoice_paid")?.occurred,
      false
    );
    assert.equal(
      partial.timeline.find((e) => e.id === "campaign_closed")?.occurred,
      false
    );
    assert.equal(
      partial.timeline.find((e) => e.id === "invoice_generated")?.occurred,
      true
    );
  });

  it("explains Finance and Performance when ahead of business stage", () => {
    const lifecycle = deriveLifecycleForTest(base({ lineCount: 0 }));
    const finance = buildWorkspaceGuidance(lifecycle, "billing");
    assert.match(finance.whatHappened, /Invoice creation is disabled/i);
    assert.equal(finance.businessStageLabel, lifecycle.businessStageLabel);
    assert.equal(finance.outOfBand, true);
    assert.ok(finance.unlockHint);

    const performance = buildWorkspaceGuidance(lifecycle, "publications");
    assert.match(performance.whatHappened, /Performance metrics unlock/i);
    assert.equal(performance.outOfBand, true);
  });

  it("explains Vendor IO while waiting on Client IO with object precision", () => {
    const lifecycle = deriveLifecycleForTest(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "under_client_review",
      })
    );
    const guidance = buildWorkspaceGuidance(lifecycle, "vendor-io");
    // STAB-011: with 0 Vendor IOs, do not claim drafts are ready.
    assert.match(guidance.whatHappened, /Vendor IO will be issued after Client IO approval/i);
    assert.ok(!/drafts are ready/i.test(guidance.whatHappened));
    assert.match(guidance.currentSituation, /Sending is disabled until/i);
    assert.match(guidance.nextAction, /Client IO/i);
    assert.equal(guidance.businessStageLabel, "Client IO");
    assert.ok(lifecycle.decisionCenter.blockers.length > 0);
    assert.equal(lifecycle.decisionCenter.primaryActionTab, "client-io");
    assert.notEqual(
      lifecycle.decisionCenter.primaryAction.toLowerCase(),
      "resolve blockers"
    );
  });

  it("says Vendor IO drafts are ready when records exist while Client IO pending (STAB-011)", () => {
    const lifecycle = deriveLifecycleForTest(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "under_client_review",
        vendorIoCount: 2,
        sentVendorIoCount: 0,
        approvedVendorIoCount: 0,
      })
    );
    assert.equal(lifecycle.vendorIoCount, 2);
    const guidance = buildWorkspaceGuidance(lifecycle, "vendor-io");
    assert.match(guidance.whatHappened, /Vendor IO drafts are ready/i);
    assert.match(guidance.currentSituation, /Sending is disabled until/i);
  });

  it("does not lock Vendor IO after Client IO is approved (TW-2026-0005 contradiction)", () => {
    const lifecycle = deriveLifecycleForTest(
      base({
        lineCount: 5,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 5,
        approvedVendorIoCount: 0,
        sentVendorIoCount: 5,
        deliverableCount: 8,
        blockerCount: 1,
      })
    );
    assert.notEqual(lifecycle.businessStageId, "client-io");
    assert.notEqual(lifecycle.businessState, "blocked");
    assert.equal(lifecycle.processCue.stageSignals["client-io"], "completed");
    assert.equal(lifecycle.decisionCenter.narrative.progressionAllowed, true);

    const guidance = buildWorkspaceGuidance(lifecycle, "vendor-io");
    // May be out-of-band vs Deliverables stage, but must NOT invent a Client IO send lock.
    assert.ok(!/Sending is disabled until/i.test(guidance.currentSituation ?? ""));
    assert.ok(!/Client IO is approved/i.test(guidance.unlockHint ?? ""));
  });

  it("STAB-018: Assignments Completed is not Done merely because lines exist", () => {
    const early = deriveLifecycleForTest(
      base({
        lineCount: 10,
        hasClientIo: true,
        clientIoStatus: "draft",
        vendorIoCount: 0,
        deliverableCount: 16,
      })
    );
    const created = early.timeline.find((e) => e.id === "assignments_created");
    const completed = early.timeline.find((e) => e.id === "assignments_completed");
    assert.equal(created?.occurred, true);
    assert.equal(completed?.occurred, false);

    const afterVendors = deriveLifecycleForTest(
      base({
        lineCount: 10,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 10,
        approvedVendorIoCount: 10,
      })
    );
    assert.equal(
      afterVendors.timeline.find((e) => e.id === "assignments_completed")?.occurred,
      true
    );
  });

  it("STAB-019: Deliverables Uploaded is not Done from planned assignment units", () => {
    const plannedOnly = deriveLifecycleForTest(
      base({
        lineCount: 10,
        hasClientIo: true,
        clientIoStatus: "draft",
        deliverableCount: 16,
        uploadedDeliverableCount: 0,
      })
    );
    assert.equal(
      plannedOnly.timeline.find((e) => e.id === "deliverables_uploaded")?.occurred,
      false
    );

    const uploaded = deriveLifecycleForTest(
      base({
        lineCount: 10,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 10,
        approvedVendorIoCount: 10,
        deliverableCount: 16,
        uploadedDeliverableCount: 3,
      })
    );
    assert.equal(
      uploaded.timeline.find((e) => e.id === "deliverables_uploaded")?.occurred,
      true
    );
    // STAB-028: Posted/upload evidence alone must not mark Publication Live.
    assert.equal(
      uploaded.timeline.find((e) => e.id === "publication_live")?.occurred,
      false
    );

    const live = deriveLifecycleForTest(
      base({
        lineCount: 10,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 10,
        approvedVendorIoCount: 10,
        deliverableCount: 16,
        uploadedDeliverableCount: 3,
        publicationCount: 1,
        activePerformance: true,
      })
    );
    assert.equal(live.timeline.find((e) => e.id === "publication_live")?.occurred, true);
  });
});
