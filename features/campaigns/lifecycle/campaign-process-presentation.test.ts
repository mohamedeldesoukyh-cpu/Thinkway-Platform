import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveCampaignProcessCue,
  processNavStateForTab,
  recommendCampaignProcessTab,
  type CampaignProcessSignals,
} from "@/features/campaigns/lifecycle/campaign-process-presentation";

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
    overdueDeliverableCount: 0,
    activePerformance: false,
    invoiceCount: 0,
    billingOutstanding: 0,
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

  it("opens Vendor IO when vendor approvals are outstanding", () => {
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
    assert.equal(cue.entryStageId, "vendor-io");
    assert.equal(cue.lifecycleSignal, "waiting_vendor");
    assert.equal(cue.waitingFor, "Vendor");
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
