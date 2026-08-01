/**
 * Mandatory regression suite — Campaign Workspace Lifecycle OS baseline.
 * Run: npm run test:campaign-workspace-lifecycle-os
 *
 * Presentation / orchestration only — protects State Strip, Process Rail,
 * Portfolio intelligence, Next Action routing, Business Stage consistency,
 * and lifecycle progression contracts.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWorkspaceGuidance,
  deriveLifecycleForTest,
  workspaceLabelForTab,
} from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import {
  deriveCampaignRisk,
  deriveDaysWaiting,
  portfolioIntelFromLifecycle,
} from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import {
  deriveCampaignProcessCue,
  processNavStateForTab,
  type CampaignProcessSignals,
} from "@/features/campaigns/lifecycle/campaign-process-presentation";
import {
  BUSINESS_PROCESS_STAGES,
  getStagePolicy,
} from "@/features/campaigns/lifecycle/campaign-stage-policy";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";

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

describe("Campaign Workspace Lifecycle OS — regression (baseline v1)", () => {
  describe("ERP Process Rail / lifecycle progression", () => {
    it("exposes a stable ordered business-process stage set", () => {
      const ids = BUSINESS_PROCESS_STAGES.map((stage) => stage.id);
      assert.deepEqual(ids, [
        "overview",
        "lines",
        "client-io",
        "vendor-io",
        "deliverables",
        "publications",
        "billing",
      ]);
      assert.ok(BUSINESS_PROCESS_STAGES.every((stage) => stage.owner && stage.label));
    });

    it("marks completed / current / upcoming rail states without disabling navigation", () => {
      const signals = base({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "under_client_review",
      });
      const cue = deriveCampaignProcessCue(signals);
      assert.equal(processNavStateForTab("lines", cue, signals), "completed");
      assert.equal(processNavStateForTab("client-io", cue, signals), "waiting_client");
      assert.equal(processNavStateForTab("billing", cue, signals), "upcoming");
      // Navigation must remain available for upcoming stages (signal only).
      assert.notEqual(processNavStateForTab("billing", cue, signals), "blocked");
    });

    it("advances recommended stage through the operating spine", () => {
      assert.equal(deriveCampaignProcessCue(base()).entryStageId, "lines");
      assert.equal(
        deriveCampaignProcessCue(
          base({ lineCount: 2, hasClientIo: true, clientIoStatus: "generated" })
        ).entryStageId,
        "client-io"
      );
      assert.equal(
        deriveCampaignProcessCue(
          base({
            lineCount: 2,
            hasClientIo: true,
            clientIoStatus: "approved",
            vendorIoCount: 2,
            approvedVendorIoCount: 1,
            sentVendorIoCount: 2,
          })
        ).entryStageId,
        "vendor-io"
      );
    });
  });

  describe("Next Action routing", () => {
    it("routes Next Action to the business entry stage", () => {
      const lifecycle = deriveLifecycleForTest(
        base({
          lineCount: 2,
          hasClientIo: true,
          clientIoStatus: "under_client_review",
        })
      );
      assert.equal(lifecycle.nextActionTab, lifecycle.businessStageId);
      assert.equal(lifecycle.nextActionTab, lifecycle.processCue.entryStageId);
      assert.ok(lifecycle.nextAction.length > 0);
      assert.ok(lifecycle.owner.length > 0);
      assert.ok(lifecycle.reason.length > 0);
      assert.ok(lifecycle.expectedResult.length > 0);
    });
  });

  describe("Business Stage consistency (living campaign object)", () => {
    it("keeps Business Stage constant across workspace views", () => {
      const lifecycle = deriveLifecycleForTest(
        base({
          lineCount: 2,
          hasClientIo: true,
          clientIoStatus: "under_client_review",
        })
      );
      const workspaces: CampaignWorkspaceTabId[] = [
        "overview",
        "lines",
        "client-io",
        "vendor-io",
        "billing",
        "publications",
        "timeline",
      ];
      for (const tab of workspaces) {
        const guidance = buildWorkspaceGuidance(lifecycle, tab);
        assert.equal(guidance.businessStageLabel, lifecycle.businessStageLabel);
        assert.equal(guidance.businessStateLabel, lifecycle.businessStateLabel);
        assert.equal(guidance.nextAction, lifecycle.nextAction);
        assert.equal(guidance.workspaceLabel, workspaceLabelForTab(tab));
      }
    });

    it("labels Finance/Performance as out-of-band while stage is Client IO", () => {
      const lifecycle = deriveLifecycleForTest(
        base({
          lineCount: 2,
          hasClientIo: true,
          clientIoStatus: "under_client_review",
        })
      );
      assert.equal(lifecycle.businessStageId, "client-io");
      assert.equal(buildWorkspaceGuidance(lifecycle, "billing").outOfBand, true);
      assert.equal(buildWorkspaceGuidance(lifecycle, "publications").outOfBand, true);
      assert.ok(buildWorkspaceGuidance(lifecycle, "billing").unlockHint);
    });
  });

  describe("Campaign State Strip / Portfolio intelligence", () => {
    it("provides strip fields: waiting for, days waiting, risk, next action", () => {
      const lifecycle = deriveLifecycleForTest(
        base({
          lineCount: 2,
          hasClientIo: true,
          clientIoStatus: "under_client_review",
        })
      );
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const intel = portfolioIntelFromLifecycle(lifecycle, {
        updatedAt: tenDaysAgo,
        endDate: null,
      });
      assert.equal(intel.waitingFor, "Client");
      assert.equal(intel.daysWaiting, 10);
      assert.equal(intel.daysWaitingLabel, "10d");
      assert.equal(intel.risk, "elevated");
      assert.equal(intel.nextAction, lifecycle.nextAction);
      assert.equal(intel.nextActionTab, lifecycle.nextActionTab);
      assert.equal(intel.businessStageLabel, lifecycle.businessStageLabel);
    });

    it("escalates long waits to stalled risk", () => {
      const lifecycle = deriveLifecycleForTest(
        base({
          lineCount: 2,
          hasClientIo: true,
          clientIoStatus: "under_client_review",
        })
      );
      assert.equal(deriveDaysWaiting(lifecycle, new Date().toISOString()), 0);
      assert.equal(deriveCampaignRisk(lifecycle, 15, null).riskLabel, "Stalled");
    });
  });

  describe("Business State model", () => {
    it("maps waiting client to Waiting Client — not Blocked", () => {
      const lifecycle = deriveLifecycleForTest(
        base({
          lineCount: 2,
          hasClientIo: true,
          clientIoStatus: "under_client_review",
        })
      );
      assert.equal(lifecycle.businessState, "waiting");
      assert.equal(lifecycle.businessStateLabel, "Waiting Client");
      assert.equal(lifecycle.blockers.length, 0);
    });

    it("uses Needs Attention for soft enforcement issues", () => {
      const lifecycle = deriveLifecycleForTest(
        base({
          lineCount: 2,
          hasClientIo: true,
          clientIoStatus: "rejected",
        })
      );
      assert.equal(getStagePolicy("client-io").enforcement, "soft");
      assert.equal(lifecycle.businessState, "needs_attention");
      assert.notEqual(lifecycle.businessState, "blocked");
    });
  });

  describe("Dimensional Health + requirements", () => {
    it("exposes required health dimensions", () => {
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
      const ids = lifecycle.health.map((slice) => slice.id);
      for (const required of [
        "commercial",
        "operations",
        "delivery",
        "finance",
        "client",
        "performance",
      ] as const) {
        assert.ok(ids.includes(required), `missing health dimension ${required}`);
      }
    });

    it("separates completed vs missing requirements for the current stage", () => {
      const lifecycle = deriveLifecycleForTest(
        base({
          lineCount: 2,
          hasClientIo: true,
          clientIoStatus: "under_client_review",
        })
      );
      assert.ok(lifecycle.requirements.some((item) => item.met));
      assert.ok(lifecycle.missing.some((label) => /client approval/i.test(label)));
      assert.ok(lifecycle.timeline.some((event) => event.id === "created"));
    });
  });
});
