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
    overdueDeliverableCount: 0,
    activePerformance: false,
    invoiceCount: 0,
    billingOutstanding: 0,
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

  it("explains Finance and Performance when ahead of business stage", () => {
    const lifecycle = deriveLifecycleForTest(base({ lineCount: 0 }));
    const finance = buildWorkspaceGuidance(lifecycle, "billing");
    assert.match(finance.whatHappened, /Complete Client IO to unlock Billing/i);
    assert.equal(finance.businessStageLabel, lifecycle.businessStageLabel);
    assert.equal(finance.outOfBand, true);
    assert.ok(finance.unlockHint);

    const performance = buildWorkspaceGuidance(lifecycle, "publications");
    assert.match(performance.whatHappened, /unlock Performance/i);
    assert.equal(performance.outOfBand, true);
  });

  it("explains Vendor IO while waiting on Client IO", () => {
    const lifecycle = deriveLifecycleForTest(
      base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "under_client_review",
      })
    );
    const guidance = buildWorkspaceGuidance(lifecycle, "vendor-io");
    assert.match(guidance.whatHappened, /Complete Client IO to unlock Vendor IO/i);
    assert.equal(guidance.nextAction, "Open Client IO");
    assert.equal(guidance.businessStageLabel, "Client IO");
    assert.ok(lifecycle.decisionCenter.blockers.length > 0);
    assert.equal(lifecycle.decisionCenter.primaryActionTab, "client-io");
    assert.notEqual(
      lifecycle.decisionCenter.primaryAction.toLowerCase(),
      "resolve blockers"
    );
  });
});
