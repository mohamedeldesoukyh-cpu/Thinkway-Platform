import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveCampaignProcessCue,
  processNavStateForTab,
  recommendCampaignProcessTab,
  signalsFromCampaignListItem,
  signalsFromCampaignWorkspace,
  type CampaignProcessSignals,
} from "@/features/campaigns/lifecycle/campaign-process-presentation";
import type { CampaignWorkspace } from "@/features/campaigns/types";

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

describe("deriveCampaignProcessCue — business rules", () => {
  it("opens Assignments when assignments are incomplete", () => {
    const cue = deriveCampaignProcessCue(base());
    assert.equal(cue.entryStageId, "lines");
    assert.equal(cue.currentStageLabel, "Assignments");
    assert.equal(cue.owner, "Operations");
    assert.equal(cue.nextStageLabel, "Client IO");
    assert.equal(cue.waitingFor, "Operations");
    assert.equal(recommendCampaignProcessTab(base()), "lines");
  });

  it("opens Client IO when waiting for client approval", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "under_client_review",
      })
    );
    assert.equal(cue.entryStageId, "client-io");
    assert.equal(cue.lifecycleSignal, "waiting_client");
    assert.equal(cue.statusLabel, "Waiting for Client Approval");
    assert.equal(cue.waitingFor, "Client");
    assert.equal(cue.nextStageLabel, "Vendor IO");
    assert.equal(cue.nextActionLabel, "Review Client IO");
  });

  it("does not pin progression on Vendor IO acceptance — campaign may continue", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 2,
        approvedVendorIoCount: 1,
        sentVendorIoCount: 1,
      })
    );
    assert.equal(cue.entryStageId, "deliverables");
    assert.equal(cue.lifecycleSignal, "attention_required");
    assert.equal(cue.stageSignals["vendor-io"], "waiting_vendor");
    assert.notEqual(cue.lifecycleSignal, "blocked");
  });

  it("does not lock Vendor IO after Client IO approval when soft finance alerts exist (TW-2026-0005)", () => {
    // Soft alerts historically inflated blockerCount and short-circuited the cue
    // to client-io + "Blocked by open issues", contradicting approved Client IO.
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 5,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 5,
        approvedVendorIoCount: 0,
        sentVendorIoCount: 5,
        deliverableCount: 10,
        blockerCount: 1, // e.g. leftover soft alert — must not derail
      })
    );
    assert.notEqual(cue.entryStageId, "client-io");
    assert.notEqual(cue.lifecycleSignal, "blocked");
    assert.ok(!/Blocked by open issues/i.test(cue.statusLabel));
    assert.equal(cue.stageSignals["client-io"], "completed");
  });

  it("still hard-blocks on PO exceeded", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        poExceeded: true,
      })
    );
    assert.equal(cue.entryStageId, "billing");
    assert.equal(cue.lifecycleSignal, "blocked");
    assert.match(cue.statusLabel, /PO limit/i);
  });

  it("list-item signals honor enriched Client IO status (STAB-008)", () => {
    const cue = deriveCampaignProcessCue(
      signalsFromCampaignListItem({
        id: "h1",
        document_number: "TW-2026-0005",
        name: "Tuna",
        status: "active",
        lines: [{ id: "l1" } as never, { id: "l2" } as never],
        client_io_status: "approved",
        has_client_io: true,
        vendor_io_count: 32,
        approved_vendor_io_count: 32,
        sent_vendor_io_count: 32,
        deliverable_count: 84,
        performance_active: false,
        po_amount_campaign_currency: 1000,
        po_consumed_amount: 0,
      } as never)
    );
    assert.notEqual(cue.entryStageId, "client-io");
    assert.ok(!/Generate Client IO/i.test(cue.nextActionLabel));
    assert.equal(cue.stageSignals["client-io"], "completed");
    assert.equal(cue.entryStageId, "deliverables");
  });

  it("list PO exceeded uses legacy line budget when governance PO is unset (STAB-012)", () => {
    // TW-2026-0002: header po_amount_campaign_currency=0 but line PO totals exceeded.
    const cue = deriveCampaignProcessCue(
      signalsFromCampaignListItem({
        id: "h2",
        document_number: "TW-2026-0002",
        name: "Test Client",
        status: "active",
        lines: [
          { id: "l1", po_amount: 5714 } as never,
          { id: "l2", po_amount: 1429 } as never,
        ],
        client_io_status: "approved",
        has_client_io: true,
        vendor_io_count: 1,
        approved_vendor_io_count: 0,
        sent_vendor_io_count: 1,
        deliverable_count: 2,
        performance_active: false,
        po_amount_campaign_currency: 0,
        po_consumed_amount: 7857.3,
        po_remaining_amount: -7857.3,
        po_status: "draft",
      } as never)
    );
    assert.equal(cue.entryStageId, "billing");
    assert.equal(cue.lifecycleSignal, "blocked");
    assert.equal(cue.nextActionLabel, "Review PO Limit");
    assert.ok(!/Open Vendor IO/i.test(cue.nextActionLabel));
  });

  it("draft Client IO with existing record says Complete — not Generate (STAB-010)", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 10,
        hasClientIo: true,
        clientIoStatus: "draft",
      })
    );
    assert.equal(cue.entryStageId, "client-io");
    assert.equal(cue.nextActionLabel, "Complete Client IO");
    assert.equal(cue.statusLabel, "Draft in progress");
    assert.ok(!/Generate Client IO/i.test(cue.nextActionLabel));
  });

  it("missing Client IO still says Generate Client IO", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 2,
        hasClientIo: false,
        clientIoStatus: null,
      })
    );
    assert.equal(cue.nextActionLabel, "Generate Client IO");
  });

  it("generated Client IO says Send Client IO", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "generated",
      })
    );
    assert.equal(cue.nextActionLabel, "Send Client IO");
    assert.equal(cue.statusLabel, "Ready to send");
  });

  it("opens Deliverables when deliverables are overdue", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 1,
        approvedVendorIoCount: 1,
        deliverableCount: 3,
        overdueDeliverableCount: 1,
      })
    );
    assert.equal(cue.entryStageId, "deliverables");
    assert.equal(cue.lifecycleSignal, "attention_required");
    assert.equal(cue.healthLabel, "Attention Required");
  });

  it("opens Performance when performance is active", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 1,
        approvedVendorIoCount: 1,
        deliverableCount: 2,
        activePerformance: true,
      })
    );
    assert.equal(cue.entryStageId, "publications");
    assert.equal(cue.currentStageLabel, "Performance");
  });

  it("opens Finance when finance is waiting", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 1,
        approvedVendorIoCount: 1,
        invoiceCount: 1,
        billingOutstanding: 2500,
      })
    );
    assert.equal(cue.entryStageId, "billing");
    assert.equal(cue.owner, "Finance");
  });

  it("STAB-032: header completed + unpaid invoice stays Finance, not Campaign complete", () => {
    const cue = deriveCampaignProcessCue(
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
    assert.equal(cue.entryStageId, "billing");
    assert.equal(cue.owner, "Finance");
    assert.match(cue.statusLabel, /Collections|Finance|outstanding/i);
    assert.notEqual(cue.lifecycleSignal, "completed");
  });

  it("STAB-032: header completed + settled invoices is Campaign complete", () => {
    const cue = deriveCampaignProcessCue(
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
    assert.equal(cue.lifecycleSignal, "completed");
    assert.match(cue.statusLabel, /complete/i);
  });

  it("STAB-033: completed cue marks every process stage Completed (not Upcoming)", () => {
    const cue = deriveCampaignProcessCue(
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
    assert.equal(cue.lifecycleSignal, "completed");
    for (const stageId of [
      "overview",
      "lines",
      "client-io",
      "vendor-io",
      "deliverables",
      "publications",
      "billing",
    ] as const) {
      assert.equal(
        cue.stageSignals[stageId],
        "completed",
        `${stageId} must be completed after campaign close-out`
      );
    }
  });

  it("prioritizes incomplete assignments over later finance signals", () => {
    const cue = deriveCampaignProcessCue(
      base({
        lineCount: 0,
        invoiceCount: 1,
        billingOutstanding: 100,
      })
    );
    assert.equal(cue.entryStageId, "lines");
  });
});

describe("processNavStateForTab", () => {
  it("marks prior stages completed and never blocks navigation semantics on upcoming", () => {
    const signals = base({
      lineCount: 2,
      hasClientIo: true,
      clientIoStatus: "under_client_review",
    });
    const cue = deriveCampaignProcessCue(signals);
    assert.equal(processNavStateForTab("overview", cue), "completed");
    assert.equal(processNavStateForTab("lines", cue), "completed");
    assert.equal(processNavStateForTab("client-io", cue), "waiting_client");
    assert.equal(processNavStateForTab("vendor-io", cue), "upcoming");
  });
});

describe("signalsFromCampaignWorkspace — STAB-015", () => {
  it("counts assignment deliverables when legacy deliverables table is empty", () => {
    const workspace = {
      status: "active",
      lines: [{ id: "l1" }, { id: "l2" }],
      client_io: { status: "approved" },
      vendor_ios: [{ status: "approved" }, { status: "approved" }],
      deliverables: [],
      assignment_deliverable_count: 2,
      invoices: [],
      financials: { billing_outstanding: 0, po_exceeded: false },
      blockers: [],
    } as unknown as CampaignWorkspace;

    const signals = signalsFromCampaignWorkspace(workspace);
    assert.equal(signals.deliverableCount, 2);
  });

  it("does not mark Performance active from assignment units alone (STAB-017)", () => {
    const workspace = {
      status: "active",
      lines: [{ id: "l1" }],
      client_io: { status: "approved" },
      vendor_ios: [],
      deliverables: [],
      assignment_deliverable_count: 84,
      assignment_uploaded_deliverable_count: 0,
      invoices: [],
      financials: { billing_outstanding: 0, po_exceeded: false },
      blockers: [],
    } as unknown as CampaignWorkspace;

    const signals = signalsFromCampaignWorkspace(workspace);
    assert.equal(signals.deliverableCount, 84);
    assert.equal(signals.uploadedDeliverableCount, 0);
    assert.equal(signals.activePerformance, false);
  });

  it("counts posted/approved as uploaded evidence (STAB-019)", () => {
    const workspace = {
      status: "active",
      lines: [{ id: "l1" }],
      client_io: { status: "approved" },
      vendor_ios: [{ status: "approved" }],
      deliverables: [
        { display_status: "posted", due_date: null },
        { display_status: "draft", due_date: null },
      ],
      assignment_deliverable_count: 10,
      assignment_uploaded_deliverable_count: 0,
      invoices: [],
      financials: { billing_outstanding: 0, po_exceeded: false },
      blockers: [],
    } as unknown as CampaignWorkspace;

    const signals = signalsFromCampaignWorkspace(workspace);
    assert.equal(signals.deliverableCount, 10);
    assert.equal(signals.uploadedDeliverableCount, 1);
  });

  it("counts assignment post schedule uploads when legacy deliverables empty (STAB-027)", () => {
    const workspace = {
      status: "active",
      lines: [{ id: "l1" }],
      client_io: { status: "approved" },
      vendor_ios: [{ status: "approved" }],
      deliverables: [],
      assignment_deliverable_count: 17,
      assignment_uploaded_deliverable_count: 3,
      publication_count: 0,
      invoices: [],
      financials: { billing_outstanding: 0, po_exceeded: false },
      blockers: [],
    } as unknown as CampaignWorkspace;

    const signals = signalsFromCampaignWorkspace(workspace);
    assert.equal(signals.deliverableCount, 17);
    assert.equal(signals.uploadedDeliverableCount, 3);
    // STAB-028: Posted alone must not activate Performance / Publication Live.
    assert.equal(signals.activePerformance, false);
    assert.equal(signals.publicationCount, 0);
  });

  it("activates Performance only when campaign_publications exist (STAB-028)", () => {
    const workspace = {
      status: "active",
      lines: [{ id: "l1" }],
      client_io: { status: "approved" },
      vendor_ios: [{ status: "approved" }],
      deliverables: [],
      assignment_deliverable_count: 17,
      assignment_uploaded_deliverable_count: 3,
      publication_count: 1,
      invoices: [],
      financials: { billing_outstanding: 0, po_exceeded: false },
      blockers: [],
    } as unknown as CampaignWorkspace;

    const signals = signalsFromCampaignWorkspace(workspace);
    assert.equal(signals.uploadedDeliverableCount, 3);
    assert.equal(signals.publicationCount, 1);
    assert.equal(signals.activePerformance, true);
  });
});
