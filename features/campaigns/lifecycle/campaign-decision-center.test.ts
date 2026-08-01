import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDecisionCenter,
  DECISION_CLEAR_PATH_MESSAGE,
  isBillingInvoiceCreationUnlocked,
  refineGenericAction,
  unlocksForStage,
} from "@/features/campaigns/lifecycle/campaign-decision-center";
import { deriveLifecycleForTest } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { CampaignProcessSignals } from "@/features/campaigns/lifecycle/campaign-process-presentation";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";

function signals(overrides: Partial<CampaignProcessSignals> = {}): CampaignProcessSignals {
  return {
    status: "active",
    lineCount: 2,
    hasClientIo: true,
    clientIoStatus: "under_client_review",
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

describe("campaign decision center", () => {
  it("never surfaces generic Resolve blockers as the primary CTA", () => {
    const refined = refineGenericAction(
      "Resolve blockers",
      "client-io",
      signals({ clientIoStatus: "under_client_review" })
    );
    assert.notEqual(refined.toLowerCase(), "resolve blockers");
    assert.equal(refined, "Open Client IO");
  });

  it("lists Client approval as an attention blocker with unlocks", () => {
    const dc = buildDecisionCenter({
      stageId: "client-io",
      stageLabel: "Client IO",
      businessState: "waiting",
      enforcement: "soft",
      owner: "Commercial",
      waitingFor: "Client",
      nextAction: "Review Client IO",
      nextActionTab: "client-io",
      expectedResult: "Client approval unlocks Vendor IO.",
      missing: ["Client approval"],
      hardBlockers: [],
      workspaceBlockers: [],
      signals: signals(),
      daysWaiting: 2,
    });

    assert.equal(dc.severityMode, "attention");
    assert.notEqual(dc.severityMode, "hard");
    assert.ok(dc.blockers.some((b) => b.id === "cio_pending"));
    assert.equal(dc.blockers[0]?.sinceLabel, "2 days");
    assert.equal(dc.blockers[0]?.actionTab, "client-io");
    assert.ok(dc.unlocks.some((u) => u.label === "Vendor IO"));
    assert.match(dc.continueReason, /Vendor IO cannot be sent/i);
    assert.notEqual(dc.primaryAction.toLowerCase(), "resolve blockers");
  });

  it("marks PO exceeded as a hard block", () => {
    const dc = buildDecisionCenter({
      stageId: "billing",
      stageLabel: "Finance",
      businessState: "blocked",
      enforcement: "hard",
      owner: "Finance",
      waitingFor: "Finance",
      nextAction: "Review PO Limit",
      nextActionTab: "billing",
      expectedResult: "PO capacity restored.",
      missing: [],
      hardBlockers: ["PO limit exceeded."],
      workspaceBlockers: [],
      signals: signals({ poExceeded: true, clientIoStatus: "approved" }),
      daysWaiting: 1,
    });

    assert.equal(dc.severityMode, "hard");
    assert.ok(dc.blockers.some((b) => b.severity === "hard" && b.id === "po_exceeded"));
    assert.equal(dc.primaryActionTab, "billing");
  });

  it("never leaves Decision Center empty when there are no blockers", () => {
    const lifecycle = deriveLifecycleForTest(
      signals({
        lineCount: 2,
        hasClientIo: true,
        clientIoStatus: "approved",
        vendorIoCount: 1,
        approvedVendorIoCount: 1,
        sentVendorIoCount: 1,
        deliverableCount: 2,
        activePerformance: true,
        invoiceCount: 1,
      })
    );
    assert.equal(lifecycle.decisionCenter.blockers.length, 0);
    assert.match(
      lifecycle.decisionCenter.continueReason,
      /No blockers|progressing normally|complete/i
    );
    assert.ok(lifecycle.decisionCenter.clearPathMessage.length > 0);
    assert.equal(
      lifecycle.decisionCenter.clearPathMessage,
      DECISION_CLEAR_PATH_MESSAGE
    );
  });

  it("keeps Create Invoice locked until Billing has started", () => {
    assert.equal(
      isBillingInvoiceCreationUnlocked({
        businessStageId: "client-io",
        billingSignal: "upcoming",
        invoiceCount: 0,
      }),
      false
    );
    assert.equal(
      isBillingInvoiceCreationUnlocked({
        businessStageId: "billing",
        billingSignal: "current",
        invoiceCount: 0,
      }),
      true
    );
  });

  it("derives distinct Decision Center content across lifecycle stages", () => {
    const fixtures: Array<{
      label: string;
      stageHint: CampaignWorkspaceTabId;
      s: CampaignProcessSignals;
    }> = [
      {
        label: "Draft / Assignments",
        stageHint: "lines",
        s: signals({
          status: "draft",
          lineCount: 0,
          hasClientIo: false,
          clientIoStatus: null,
        }),
      },
      {
        label: "Client IO",
        stageHint: "client-io",
        s: signals({
          clientIoStatus: "under_client_review",
        }),
      },
      {
        label: "Vendor IO",
        stageHint: "vendor-io",
        s: signals({
          clientIoStatus: "approved",
          vendorIoCount: 2,
          approvedVendorIoCount: 0,
          sentVendorIoCount: 2,
        }),
      },
      {
        label: "Deliverables",
        stageHint: "deliverables",
        s: signals({
          clientIoStatus: "approved",
          vendorIoCount: 1,
          approvedVendorIoCount: 1,
          sentVendorIoCount: 1,
          deliverableCount: 3,
          overdueDeliverableCount: 1,
        }),
      },
      {
        label: "Performance",
        stageHint: "publications",
        s: signals({
          clientIoStatus: "approved",
          vendorIoCount: 1,
          approvedVendorIoCount: 1,
          sentVendorIoCount: 1,
          deliverableCount: 2,
          activePerformance: true,
        }),
      },
      {
        label: "Finance",
        stageHint: "billing",
        s: signals({
          clientIoStatus: "approved",
          vendorIoCount: 1,
          approvedVendorIoCount: 1,
          sentVendorIoCount: 1,
          deliverableCount: 2,
          activePerformance: true,
          invoiceCount: 1,
          billingOutstanding: 1200,
        }),
      },
      {
        label: "Closed",
        stageHint: "overview",
        s: signals({
          status: "completed",
          clientIoStatus: "approved",
          vendorIoCount: 1,
          approvedVendorIoCount: 1,
          sentVendorIoCount: 1,
          deliverableCount: 2,
          activePerformance: true,
          invoiceCount: 1,
        }),
      },
    ];

    const fingerprints = new Set<string>();
    for (const fixture of fixtures) {
      const lifecycle = deriveLifecycleForTest(fixture.s);
      assert.equal(
        lifecycle.businessStageId,
        fixture.stageHint,
        `${fixture.label} should resolve to ${fixture.stageHint}`
      );
      assert.ok(lifecycle.decisionCenter.unlocks.length > 0, fixture.label);
      assert.ok(lifecycle.decisionCenter.primaryAction.length > 0, fixture.label);
      assert.ok(lifecycle.decisionCenter.continueReason.length > 0, fixture.label);
      assert.notEqual(
        lifecycle.decisionCenter.primaryAction.toLowerCase(),
        "resolve blockers",
        fixture.label
      );
      const unlockKey = unlocksForStage(lifecycle.businessStageId)
        .unlocks.map((u) => u.id)
        .join("|");
      const fp = [
        lifecycle.businessStageId,
        lifecycle.decisionCenter.primaryAction,
        lifecycle.decisionCenter.primaryActionTab,
        unlockKey,
        lifecycle.owner,
      ].join("::");
      fingerprints.add(fp);

      // Executable CTAs never dump the user on Overview unless that is the stage.
      if (lifecycle.businessStageId !== "overview") {
        assert.notEqual(
          lifecycle.decisionCenter.primaryActionTab,
          "overview",
          `${fixture.label} CTA must open the work workspace`
        );
      }
    }
    assert.equal(fingerprints.size, fixtures.length);
  });
});
