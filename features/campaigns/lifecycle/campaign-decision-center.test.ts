import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDecisionFocusToSearch,
  buildDecisionCenter,
  DECISION_CLEAR_PATH_MESSAGE,
  isBillingInvoiceCreationUnlocked,
  refineGenericAction,
  unlocksForStage,
  type DecisionCenterObjects,
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
    uploadedDeliverableCount: 0,
    overdueDeliverableCount: 0,
    activePerformance: false,
    invoiceCount: 0,
    billingOutstanding: 0,
    blockerCount: 0,
    poExceeded: false,
    ...overrides,
  };
}

function objects(overrides: Partial<DecisionCenterObjects> = {}): DecisionCenterObjects {
  return {
    clientIo: {
      id: "cio-1",
      document_number: "CIO-2026-0003",
      status: "under_client_review",
    },
    vendorIos: [],
    lines: [],
    deliverables: [],
    invoices: [],
    campaignDocumentNumber: "TW-2026-0001",
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

  it("lists Client approval as a Business Blocker with object precision", () => {
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
      objects: objects(),
    });

    assert.equal(dc.severityMode, "business_blocker");
    assert.equal(dc.narrative.progressionAllowed, false);
    const pending = dc.blockers.find((b) => b.id === "cio_pending");
    assert.ok(pending);
    assert.equal(pending?.severity, "business_blocker");
    assert.equal(pending?.objectKind, "client_io");
    assert.equal(pending?.objectRef, "#CIO-2026-0003");
    assert.equal(pending?.waitingLabel, "Client");
    assert.equal(pending?.sinceLabel, "2 days");
    assert.equal(pending?.actionTab, "client-io");
    assert.deepEqual(pending?.focusQuery, { key: "io", value: "cio-1" });
    assert.match(pending?.primaryAction ?? "", /CIO-2026-0003/);
    assert.match(pending?.impact ?? "", /cannot advance/i);
    assert.ok(dc.unlocks.some((u) => u.label === "Vendor IO"));
    assert.match(dc.continueReason, /approved|Client/i);
    assert.notEqual(dc.primaryAction.toLowerCase(), "resolve blockers");
    assert.match(dc.headline, /Business Blocker/i);
  });

  it("draft Client IO does not say Generate Client IO (STAB-010 / L'Oréal)", () => {
    const dc = buildDecisionCenter({
      stageId: "client-io",
      stageLabel: "Client IO",
      businessState: "waiting",
      enforcement: "soft",
      owner: "Commercial",
      waitingFor: "Commercial",
      nextAction: "Complete Client IO",
      nextActionTab: "client-io",
      expectedResult: "Client IO document generated and ready to send.",
      missing: [],
      hardBlockers: [],
      workspaceBlockers: [],
      signals: signals({
        hasClientIo: true,
        clientIoStatus: "draft",
      }),
      daysWaiting: 0,
      objects: objects({
        clientIo: {
          id: "cio-6",
          document_number: "CIO-2026-0006",
          status: "draft",
        },
      }),
    });
    const draftBlocker = dc.blockers.find((b) => b.id === "cio_complete_draft");
    assert.ok(draftBlocker, "expected cio_complete_draft blocker");
    assert.equal(draftBlocker?.waitingLabel, "Composition");
    assert.match(draftBlocker?.reason ?? "", /Complete #CIO-2026-0006/i);
    assert.ok(!dc.blockers.some((b) => b.id === "cio_generate"));
    assert.ok(!/Generate Client IO/i.test(dc.primaryAction));
    assert.ok(!/Generate Client IO/i.test(draftBlocker?.reason ?? ""));
  });

  it("missing Client IO still surfaces Generate blocker", () => {
    const dc = buildDecisionCenter({
      stageId: "client-io",
      stageLabel: "Client IO",
      businessState: "waiting",
      enforcement: "soft",
      owner: "Commercial",
      waitingFor: "Commercial",
      nextAction: "Generate Client IO",
      nextActionTab: "client-io",
      expectedResult: "Client IO ready to send for approval.",
      missing: [],
      hardBlockers: [],
      workspaceBlockers: [],
      signals: signals({
        hasClientIo: false,
        clientIoStatus: null,
      }),
      daysWaiting: 0,
      objects: objects({ clientIo: null }),
    });
    assert.ok(dc.blockers.some((b) => b.id === "cio_generate"));
    assert.match(dc.primaryAction, /Generate Client IO/i);
  });

  it("aggregates many pending Vendor IOs as Operational Attention", () => {
    const dc = buildDecisionCenter({
      stageId: "deliverables",
      stageLabel: "Deliverables",
      businessState: "needs_attention",
      enforcement: "soft",
      owner: "Operations",
      waitingFor: "Operations",
      nextAction: "Open Vendor IO Register",
      nextActionTab: "vendor-io",
      expectedResult: "Vendor documentation recorded.",
      missing: [],
      hardBlockers: [],
      workspaceBlockers: [],
      signals: signals({
        clientIoStatus: "approved",
        vendorIoCount: 2,
        approvedVendorIoCount: 0,
        sentVendorIoCount: 2,
      }),
      daysWaiting: 1,
      objects: objects({
        clientIo: {
          id: "cio-1",
          document_number: "CIO-2026-0003",
          status: "approved",
        },
        vendorIos: [
          {
            id: "vio-38",
            document_number: "VIO-2026-38",
            status: "sent",
            influencer_name: "Ahmed Hassan",
          },
          {
            id: "vio-39",
            document_number: "VIO-2026-39",
            status: "sent",
            influencer_name: "Sara Ali",
          },
        ],
      }),
    });

    const vioCards = dc.blockers.filter((b) => b.objectKind === "vendor_io");
    assert.equal(vioCards.length, 1);
    assert.equal(vioCards[0]?.severity, "operational_attention");
    assert.equal(vioCards[0]?.objectLabel, "Vendor IO");
    assert.equal(vioCards[0]?.objectRef, "2 Vendor IOs");
    assert.match(vioCards[0]?.waitingLabel ?? "", /2 creators|Ahmed/);
    assert.match(vioCards[0]?.impact ?? "", /may continue|ops follow-up/i);
    assert.match(vioCards[0]?.unlockLabel ?? "", /compliance|acknowledgement/i);
    assert.deepEqual(vioCards[0]?.focusQuery, { key: "io", value: "vio-38" });
    assert.equal(vioCards[0]?.primaryAction, "Open Vendor IO Register");
    assert.equal(dc.severityMode, "operational_attention");
    assert.equal(dc.narrative.progressionAllowed, true);
    assert.equal(dc.narrative.currentStageComplete, true);
    assert.match(dc.narrative.currentStageLabel, /Client IO/i);
    assert.notEqual(dc.primaryAction.toLowerCase(), "follow up vendor io");
  });

  it("states Client approval as a single narrative with Vendor IO impact", () => {
    const dc = buildDecisionCenter({
      stageId: "client-io",
      stageLabel: "Client IO",
      businessState: "waiting",
      enforcement: "soft",
      owner: "Commercial",
      waitingFor: "Client",
      nextAction: "Open Client IO",
      nextActionTab: "client-io",
      expectedResult: "Client approval unlocks Vendor IO.",
      missing: [],
      hardBlockers: [],
      workspaceBlockers: [],
      signals: signals({ clientIoStatus: "under_client_review" }),
      daysWaiting: 2,
      objects: objects(),
    });

    assert.equal(dc.blockers.filter((b) => b.objectKind === "client_io").length, 1);
    assert.equal(dc.blockers.filter((b) => b.objectKind === "vendor_io").length, 0);
    assert.match(dc.blockers[0]?.impact ?? "", /Vendor IO cannot be sent/i);
    assert.match(dc.headline, /Business Blocker/i);
    assert.equal(dc.narrative.progressionAllowed, false);
  });

  it("marks PO exceeded as a Business Blocker", () => {
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

    assert.equal(dc.severityMode, "business_blocker");
    assert.ok(
      dc.blockers.some(
        (b) => b.severity === "business_blocker" && b.id === "po_exceeded"
      )
    );
    assert.equal(dc.primaryActionTab, "billing");
    assert.equal(dc.narrative.progressionAllowed, false);
  });

  it("never implies Client IO is blocked after Client IO is approved", () => {
    const lifecycle = deriveLifecycleForTest(
      signals({
        clientIoStatus: "approved",
        vendorIoCount: 3,
        approvedVendorIoCount: 0,
        sentVendorIoCount: 3,
      })
    );
    assert.equal(lifecycle.businessStageId, "deliverables");
    assert.ok(
      lifecycle.decisionCenter.blockers.every((b) => b.objectKind !== "client_io")
    );
    assert.match(lifecycle.decisionCenter.narrative.currentStageLabel, /Client IO/i);
    assert.equal(lifecycle.decisionCenter.narrative.currentStageComplete, true);
    assert.equal(lifecycle.decisionCenter.narrative.progressionAllowed, true);
    assert.match(
      lifecycle.decisionCenter.narrative.progressionLabel,
      /may continue/i
    );
    assert.equal(
      lifecycle.decisionCenter.blockers[0]?.severity,
      "operational_attention"
    );
  });

  it("treats Creator payouts as Finance ops — never Campaign Issue business blocker (TW-2026-0005)", () => {
    const dc = buildDecisionCenter({
      stageId: "deliverables",
      stageLabel: "Deliverables",
      businessState: "needs_attention",
      enforcement: "soft",
      owner: "Operations",
      waitingFor: "Operations",
      nextAction: "Open Vendor IO Register",
      nextActionTab: "vendor-io",
      expectedResult: "Vendor follow-up complete.",
      missing: [],
      hardBlockers: ["Creator payouts outstanding"],
      workspaceBlockers: ["Creator payouts outstanding"],
      signals: signals({
        clientIoStatus: "approved",
        vendorIoCount: 5,
        approvedVendorIoCount: 0,
        sentVendorIoCount: 5,
        deliverableCount: 10,
        blockerCount: 1,
      }),
      daysWaiting: 2,
      objects: objects({
        clientIo: {
          id: "cio-1",
          document_number: "CIO-2026-0005",
          status: "approved",
        },
        campaignDocumentNumber: "TW-2026-0005",
        vendorIos: [
          {
            id: "vio-1",
            document_number: "VIO-2026-0001",
            status: "sent",
            influencer_name: "Creator A",
          },
        ],
      }),
    });

    assert.equal(
      dc.blockers.every((b) => b.severity !== "business_blocker"),
      true,
      "payouts must not be a business blocker after Client IO approval"
    );
    assert.equal(
      dc.blockers.some((b) => /Campaign issue/i.test(b.objectLabel)),
      false
    );
    assert.equal(dc.narrative.progressionAllowed, true);
    assert.match(dc.narrative.progressionLabel, /may continue/i);
    // Executive story stays Vendor IO compliance — not a false Campaign Issue.
    assert.ok(dc.blockers.some((b) => b.objectKind === "vendor_io"));
  });

  it("does not treat the substring po inside payouts as a Purchase Order hard blocker", () => {
    const dc = buildDecisionCenter({
      stageId: "billing",
      stageLabel: "Finance",
      businessState: "waiting",
      enforcement: "soft",
      owner: "Finance",
      waitingFor: "Finance",
      nextAction: "Open Finance",
      nextActionTab: "billing",
      expectedResult: "Payouts clear.",
      missing: [],
      hardBlockers: [],
      workspaceBlockers: ["Creator payouts outstanding"],
      signals: signals({
        clientIoStatus: "approved",
        vendorIoCount: 1,
        approvedVendorIoCount: 1,
        sentVendorIoCount: 1,
      }),
      daysWaiting: 0,
      objects: objects({
        campaignDocumentNumber: "TW-2026-0005",
        clientIo: {
          id: "cio-1",
          document_number: "CIO-2026-0005",
          status: "approved",
        },
        vendorIos: [
          {
            id: "vio-1",
            document_number: "VIO-2026-0001",
            status: "approved",
            influencer_name: "Creator A",
          },
        ],
      }),
    });
    const payout = dc.blockers.find((b) => /payout/i.test(b.title));
    assert.ok(payout);
    assert.equal(payout?.severity, "operational_attention");
    assert.equal(payout?.actionTab, "billing");
    assert.notEqual(payout?.objectKind, "po");
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
      /No operational items|progressing normally|complete/i
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

  it("applies focus query params for exact-record CTAs", () => {
    assert.equal(
      applyDecisionFocusToSearch("?tab=vendor-io&docsCreator=x", {
        key: "io",
        value: "vio-38",
      }),
      "?tab=vendor-io&io=vio-38"
    );
    assert.equal(
      applyDecisionFocusToSearch("?tab=deliverables", {
        key: "deliverable",
        value: "del-1",
      }),
      "?tab=deliverables&deliverable=del-1"
    );
    assert.equal(
      applyDecisionFocusToSearch("?tab=workflow&approval=old", {
        key: "approval",
        value: "apr-9",
      }),
      "?tab=workflow&approval=apr-9"
    );
  });

  it("keeps Decision Center compact for large vendor IO sets", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      id: `vio-${index}`,
      document_number: `VIO-2026-${index}`,
      status: "sent",
      influencer_name: `Creator ${index}`,
    }));
    const dc = buildDecisionCenter({
      stageId: "vendor-io",
      stageLabel: "Vendor IO",
      businessState: "waiting",
      enforcement: "soft",
      owner: "Operations",
      waitingFor: "Vendor",
      nextAction: "Open Vendor IO",
      nextActionTab: "vendor-io",
      expectedResult: "Approvals unlock deliverables.",
      missing: [],
      hardBlockers: [],
      workspaceBlockers: [],
      signals: signals({
        clientIoStatus: "approved",
        vendorIoCount: 40,
        approvedVendorIoCount: 0,
        sentVendorIoCount: 40,
      }),
      daysWaiting: 3,
      objects: objects({
        clientIo: {
          id: "cio-1",
          document_number: "CIO-2026-0003",
          status: "approved",
        },
        vendorIos: many,
      }),
    });
    assert.equal(dc.blockers.filter((b) => b.objectKind === "vendor_io").length, 1);
    assert.match(dc.blockers[0]?.objectRef ?? "", /40 Vendor IOs/);
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
        label: "Client approved + Vendor IO compliance",
        stageHint: "deliverables",
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
      assert.notEqual(
        lifecycle.decisionCenter.primaryAction.toLowerCase(),
        "open pending approval",
        fixture.label
      );
      for (const blocker of lifecycle.decisionCenter.blockers) {
        assert.ok(blocker.objectLabel.length > 0, fixture.label);
        assert.ok(blocker.objectRef.length > 0, fixture.label);
        assert.ok(blocker.waitingLabel.length > 0, fixture.label);
      }
      const unlockKey = unlocksForStage(lifecycle.businessStageId)
        .unlocks.map((u) => u.id)
        .join("|");
      const fp = [
        lifecycle.businessStageId,
        lifecycle.decisionCenter.severityMode,
        lifecycle.decisionCenter.primaryAction,
        lifecycle.decisionCenter.primaryActionTab,
        lifecycle.decisionCenter.blockers.map((b) => b.id).join(","),
        lifecycle.decisionCenter.narrative.dependencyDetail,
        unlockKey,
        lifecycle.owner,
      ].join("::");
      fingerprints.add(fp);

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
