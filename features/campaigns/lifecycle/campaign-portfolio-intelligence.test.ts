import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveCampaignRisk,
  deriveDaysWaiting,
} from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import { deriveLifecycleForTest } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { CampaignProcessSignals } from "@/features/campaigns/lifecycle/campaign-process-presentation";

function base(overrides: Partial<CampaignProcessSignals> = {}): CampaignProcessSignals {
  return {
    status: "active",
    lineCount: 2,
    hasClientIo: true,
    clientIoStatus: "under_client_review",
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
    blockerCount: 0,
    poExceeded: false,
    ...overrides,
  };
}

describe("campaign portfolio intelligence", () => {
  it("counts days waiting while Waiting Client", () => {
    const lifecycle = deriveLifecycleForTest(base());
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const days = deriveDaysWaiting(lifecycle, tenDaysAgo);
    assert.equal(days, 10);
    const risk = deriveCampaignRisk(lifecycle, days, null);
    assert.equal(risk.risk, "elevated");
  });

  it("marks stalled waiting after 14 days", () => {
    const lifecycle = deriveLifecycleForTest(base());
    const risk = deriveCampaignRisk(lifecycle, 15, null);
    assert.equal(risk.risk, "critical");
    assert.equal(risk.riskLabel, "Stalled");
  });

  it("returns no days waiting when campaign is completed", () => {
    const lifecycle = deriveLifecycleForTest(base({ status: "completed" }));
    assert.equal(lifecycle.businessState, "completed");
    assert.equal(deriveDaysWaiting(lifecycle, new Date().toISOString()), null);
  });
});
