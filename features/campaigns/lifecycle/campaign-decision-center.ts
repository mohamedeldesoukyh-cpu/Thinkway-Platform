/**
 * Decision Center — presentation-only refinement of Lifecycle OS.
 * Derives blockers, CTAs, and unlocks from lifecycle signals/rules — not hardcoded page copy.
 * No API · DB · workflow · permission · stage-policy changes.
 */

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignProcessSignals } from "@/features/campaigns/lifecycle/campaign-process-presentation";
import type { BusinessState } from "@/lib/business-process/business-state";
import type {
  BusinessProcessOwner,
  BusinessProcessWaitingParty,
} from "@/lib/business-process/types";

export type DecisionSeverity = "hard" | "attention";

export type DecisionBlocker = {
  id: string;
  title: string;
  severity: DecisionSeverity;
  owner: BusinessProcessOwner;
  waitingFor: BusinessProcessWaitingParty | "None";
  sinceLabel: string;
  whyBlocks: string;
  primaryAction: string;
  actionTab: CampaignWorkspaceTabId;
  relatedLabel: string | null;
  expectedResult: string;
};

export type UnlockPreview = {
  id: string;
  label: string;
};

export type CampaignDecisionCenter = {
  /** Where am I / can I continue posture. */
  headline: string;
  severityMode: "hard" | "attention" | "waiting" | "clear" | "progress";
  /** Why can't I continue? — never empty. */
  continueReason: string;
  remainingBlockerLabels: string[];
  /** What will unlock after completing the current stage? */
  unlockHeadline: string;
  unlocks: UnlockPreview[];
  blockers: DecisionBlocker[];
  /** Specific verb CTA — never bare "Resolve blockers". */
  primaryAction: string;
  primaryActionTab: CampaignWorkspaceTabId;
  /** Offer Smart Blocker Resolver when there is work to clear. */
  openResolver: boolean;
  /** Clear-path message when there are no blockers. */
  clearPathMessage: string;
};

export const DECISION_CLEAR_PATH_MESSAGE =
  "No blockers. Campaign is progressing normally.";

function daysLabel(daysWaiting: number | null | undefined): string {
  if (daysWaiting == null) return "—";
  if (daysWaiting <= 0) return "Today";
  if (daysWaiting === 1) return "1 day";
  return `${daysWaiting} days`;
}

export function unlocksForStage(stageId: CampaignWorkspaceTabId): {
  headline: string;
  unlocks: UnlockPreview[];
} {
  switch (stageId) {
    case "lines":
      return {
        headline: "Completing Assignments unlocks",
        unlocks: [
          { id: "cio", label: "Client IO" },
          { id: "commercial", label: "Commercial packaging" },
          { id: "terms", label: "Client terms review" },
        ],
      };
    case "client-io":
      return {
        headline: "Completing Client IO unlocks",
        unlocks: [
          { id: "vio", label: "Vendor IO" },
          { id: "vendor_approvals", label: "Vendor approvals" },
          { id: "creator_confirm", label: "Creator confirmation" },
        ],
      };
    case "vendor-io":
      return {
        headline: "Completing Vendor IO unlocks",
        unlocks: [
          { id: "deliverables", label: "Deliverables" },
          { id: "uploads", label: "Creator uploads" },
          { id: "scheduling", label: "Publication scheduling" },
        ],
      };
    case "deliverables":
      return {
        headline: "Completing Deliverables unlocks",
        unlocks: [
          { id: "publications", label: "Performance" },
          { id: "live", label: "Live publications" },
          { id: "metrics", label: "Campaign metrics" },
        ],
      };
    case "publications":
      return {
        headline: "Completing Performance unlocks",
        unlocks: [
          { id: "billing", label: "Finance" },
          { id: "invoices", label: "Invoice generation" },
          { id: "collections", label: "Collections follow-up" },
        ],
      };
    case "billing":
      return {
        headline: "Completing Finance unlocks",
        unlocks: [
          { id: "close", label: "Campaign close-out" },
          { id: "reporting", label: "Final reporting" },
          { id: "archive", label: "Archive readiness" },
        ],
      };
    case "overview":
      return {
        headline: "Campaign close-out unlocks",
        unlocks: [
          { id: "archive", label: "Archive readiness" },
          { id: "reporting", label: "Final reporting" },
          { id: "reuse", label: "Reusable campaign learnings" },
        ],
      };
    default:
      return {
        headline: "Completing this stage unlocks",
        unlocks: [{ id: "next", label: "Next lifecycle stage" }],
      };
  }
}

function pushUnique(blockers: DecisionBlocker[], item: DecisionBlocker) {
  if (blockers.some((existing) => existing.id === item.id)) return;
  blockers.push(item);
}

function actionTabFromLabel(
  label: string,
  stageId: CampaignWorkspaceTabId
): CampaignWorkspaceTabId {
  const lower = label.toLowerCase();
  if (lower.includes("client")) return "client-io";
  if (lower.includes("vendor")) return "vendor-io";
  if (lower.includes("assignment")) return "lines";
  if (lower.includes("invoice") || lower.includes("finance") || lower.includes("billing")) {
    return "billing";
  }
  if (lower.includes("deliverable")) return "deliverables";
  if (lower.includes("performance") || lower.includes("publication")) {
    return "publications";
  }
  return stageId === "overview" ? "overview" : stageId;
}

/**
 * Build structured Decision Center items from existing lifecycle signals.
 * Soft issues are "attention"; hard enforcement / PO / rejected CIO are "hard".
 */
export function buildDecisionCenter(input: {
  stageId: CampaignWorkspaceTabId;
  stageLabel: string;
  businessState: BusinessState;
  enforcement: "none" | "soft" | "hard";
  owner: BusinessProcessOwner;
  waitingFor: BusinessProcessWaitingParty;
  nextAction: string;
  nextActionTab: CampaignWorkspaceTabId;
  expectedResult: string;
  missing: string[];
  hardBlockers: string[];
  workspaceBlockers: string[];
  signals: CampaignProcessSignals;
  daysWaiting: number | null;
}): CampaignDecisionCenter {
  const {
    stageId,
    stageLabel,
    businessState,
    enforcement,
    owner,
    waitingFor,
    nextAction,
    nextActionTab,
    expectedResult,
    missing,
    hardBlockers,
    workspaceBlockers,
    signals,
    daysWaiting,
  } = input;

  const since = daysLabel(daysWaiting);
  const blockers: DecisionBlocker[] = [];
  const hard = enforcement === "hard";

  if (signals.poExceeded) {
    pushUnique(blockers, {
      id: "po_exceeded",
      title: "PO limit exceeded",
      severity: "hard",
      owner: "Finance",
      waitingFor: "Finance",
      sinceLabel: since,
      whyBlocks: "Commercial spend exceeds the purchase-order ceiling.",
      primaryAction: "Review PO Limit",
      actionTab: "billing",
      relatedLabel: null,
      expectedResult: "PO capacity restored so commercial work can continue.",
    });
  }

  if (signals.clientIoStatus === "rejected") {
    pushUnique(blockers, {
      id: "cio_rejected",
      title: "Client IO rejected",
      severity: hard ? "hard" : "attention",
      owner: "Commercial",
      waitingFor: "Commercial",
      sinceLabel: since,
      whyBlocks: "Vendor IO cannot be sent until Client IO is reworked and approved.",
      primaryAction: "Review Client Feedback",
      actionTab: "client-io",
      relatedLabel: null,
      expectedResult: "Revised Client IO ready for re-approval.",
    });
  }

  const waitingClient =
    signals.clientIoStatus === "sent" ||
    signals.clientIoStatus === "under_client_review";

  if (waitingClient) {
    pushUnique(blockers, {
      id: "cio_pending",
      title: "Client approval pending",
      severity: "attention",
      owner: "Commercial",
      waitingFor: "Client",
      sinceLabel: since,
      whyBlocks: "Vendor IO cannot be sent until Client IO is approved.",
      primaryAction: "Open Client IO",
      actionTab: "client-io",
      relatedLabel: null,
      expectedResult: "Client approval unlocks Vendor IO issuance.",
    });
  }

  if (
    stageId === "client-io" &&
    (!signals.hasClientIo ||
      !signals.clientIoStatus ||
      signals.clientIoStatus === "draft")
  ) {
    pushUnique(blockers, {
      id: "cio_generate",
      title: "Client IO not generated",
      severity: "attention",
      owner: "Commercial",
      waitingFor: "Commercial",
      sinceLabel: since,
      whyBlocks: "Generate Client IO to package commercial terms for approval.",
      primaryAction: "Generate Client IO",
      actionTab: "client-io",
      relatedLabel: null,
      expectedResult: "Client IO ready to send for approval.",
    });
  }

  if (stageId === "client-io" && signals.clientIoStatus === "generated") {
    pushUnique(blockers, {
      id: "cio_send",
      title: "Client IO ready to send",
      severity: "attention",
      owner: "Commercial",
      waitingFor: "Commercial",
      sinceLabel: since,
      whyBlocks: "Send Client IO so the client can approve commercial terms.",
      primaryAction: "Send Client IO",
      actionTab: "client-io",
      relatedLabel: null,
      expectedResult: "Client review begins after send.",
    });
  }

  if (signals.lineCount === 0 && signals.status !== "cancelled" && signals.status !== "completed") {
    pushUnique(blockers, {
      id: "assignments",
      title: "Assignments incomplete",
      severity: "attention",
      owner: "Operations",
      waitingFor: "Operations",
      sinceLabel: since,
      whyBlocks: "Complete Assignments before Client IO can be prepared.",
      primaryAction: "Complete Assignments",
      actionTab: "lines",
      relatedLabel: null,
      expectedResult: "Assignments ready for Client IO packaging.",
    });
  }

  if (
    signals.clientIoStatus === "approved" &&
    signals.vendorIoCount === 0 &&
    stageId === "vendor-io"
  ) {
    pushUnique(blockers, {
      id: "vio_issue",
      title: "Vendor IO not issued",
      severity: "attention",
      owner: "Operations",
      waitingFor: "Operations",
      sinceLabel: since,
      whyBlocks: "Issue Vendor IO so creators can confirm engagement.",
      primaryAction: "Issue Vendor IO",
      actionTab: "vendor-io",
      relatedLabel: null,
      expectedResult: "Vendor IO ready to send for approval.",
    });
  }

  if (
    signals.clientIoStatus === "approved" &&
    signals.vendorIoCount > 0 &&
    signals.approvedVendorIoCount < signals.vendorIoCount
  ) {
    const pending = signals.vendorIoCount - signals.approvedVendorIoCount;
    pushUnique(blockers, {
      id: "vio_pending",
      title: "Vendor approval outstanding",
      severity: "attention",
      owner: "Operations",
      waitingFor: "Vendor",
      sinceLabel: since,
      whyBlocks: "Follow up Vendor IO so deliverables can unlock.",
      primaryAction: "Follow Up Vendor IO",
      actionTab: "vendor-io",
      relatedLabel: `${pending} pending`,
      expectedResult: "Vendor approvals unlock deliverable work.",
    });
  }

  if (signals.overdueDeliverableCount > 0) {
    pushUnique(blockers, {
      id: "deliverables_overdue",
      title: "Overdue deliverables",
      severity: "attention",
      owner: "Operations",
      waitingFor: "Operations",
      sinceLabel: since,
      whyBlocks: "Resolve overdue deliverables before performance tracking slips.",
      primaryAction: "Resolve Overdue Deliverables",
      actionTab: "deliverables",
      relatedLabel: `${signals.overdueDeliverableCount} overdue`,
      expectedResult: "Delivery schedule back on track.",
    });
  }

  if (
    stageId === "billing" &&
    signals.invoiceCount === 0 &&
    signals.billingOutstanding <= 0 &&
    signals.clientIoStatus === "approved"
  ) {
    pushUnique(blockers, {
      id: "finance_start",
      title: "Invoices not started",
      severity: "attention",
      owner: "Finance",
      waitingFor: "Finance",
      sinceLabel: since,
      whyBlocks: "Open Finance to generate the first invoice.",
      primaryAction: "Open Finance",
      actionTab: "billing",
      relatedLabel: null,
      expectedResult: "Invoice generation unlocked.",
    });
  }

  if (stageId === "billing" && signals.billingOutstanding > 0) {
    pushUnique(blockers, {
      id: "finance_collection",
      title: "Collections outstanding",
      severity: "attention",
      owner: "Finance",
      waitingFor: "Finance",
      sinceLabel: since,
      whyBlocks: "Follow up Finance to clear outstanding balances.",
      primaryAction: "Follow Up Finance",
      actionTab: "billing",
      relatedLabel: null,
      expectedResult: "Collections progress toward close-out.",
    });
  }

  for (const [index, text] of workspaceBlockers.entries()) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const tab = actionTabFromLabel(trimmed, nextActionTab);
    pushUnique(blockers, {
      id: `workspace_blocker_${index}`,
      title: trimmed.replace(/\.$/, ""),
      severity: hard || hardBlockers.length > 0 ? "hard" : "attention",
      owner,
      waitingFor: waitingFor === "None" ? "Operations" : waitingFor,
      sinceLabel: since,
      whyBlocks: "Clear this open issue so the campaign can advance.",
      primaryAction: "Open Pending Approval",
      actionTab: tab,
      relatedLabel: null,
      expectedResult,
    });
  }

  for (const label of missing) {
    const lower = label.toLowerCase();
    if (
      blockers.some(
        (b) =>
          b.title.toLowerCase().includes(lower) ||
          lower.includes(b.title.toLowerCase().slice(0, 12))
      )
    ) {
      continue;
    }
    if (lower.includes("campaign created")) continue;
    const tab = actionTabFromLabel(label, stageId);
    pushUnique(blockers, {
      id: `missing_${label.toLowerCase().replace(/\s+/g, "_")}`,
      title: label,
      severity: "attention",
      owner,
      waitingFor: waitingFor === "None" ? owner : waitingFor,
      sinceLabel: since,
      whyBlocks: `Complete "${label}" to finish ${stageLabel}.`,
      primaryAction: specificActionFromLabel(label, stageId),
      actionTab: tab,
      relatedLabel: null,
      expectedResult,
    });
  }

  const hardItems = blockers.filter((b) => b.severity === "hard");
  const attentionItems = blockers.filter((b) => b.severity === "attention");

  let severityMode: CampaignDecisionCenter["severityMode"] = "progress";
  let headline = `Working in ${stageLabel}`;
  if (businessState === "blocked" || hardItems.length > 0) {
    severityMode = "hard";
    headline = "Campaign cannot continue";
  } else if (businessState === "needs_attention" || attentionItems.length > 0) {
    severityMode = "attention";
    headline =
      businessState === "waiting"
        ? "Campaign is waiting"
        : "Campaign can continue but requires review";
  } else if (businessState === "waiting") {
    severityMode = "waiting";
    headline = "Campaign is waiting";
  } else if (businessState === "completed" || businessState === "closed") {
    severityMode = "clear";
    headline = "Campaign lifecycle complete";
  } else if (businessState === "draft") {
    severityMode = blockers.length > 0 ? "attention" : "progress";
    headline = blockers.length > 0 ? "Campaign needs setup" : "Campaign draft";
  } else if (blockers.length === 0) {
    severityMode = "clear";
    headline = `Working in ${stageLabel}`;
  }

  const refinedFallback = refineGenericAction(nextAction, stageId, signals);
  const primary = blockers[0]
    ? {
        primaryAction: blockers[0].primaryAction,
        actionTab: blockers[0].actionTab,
      }
    : {
        primaryAction: refinedFallback,
        actionTab: nextActionTab,
      };

  const clearPathMessage =
    businessState === "completed" || businessState === "closed"
      ? "No blockers. Campaign lifecycle is complete."
      : DECISION_CLEAR_PATH_MESSAGE;

  const continueReason =
    blockers.length > 0
      ? blockers[0].whyBlocks
      : businessState === "waiting"
        ? `Waiting for ${waitingFor === "None" ? "the next stakeholder" : waitingFor}. Take the next action when they respond.`
        : clearPathMessage;

  const { headline: unlockHeadline, unlocks } = unlocksForStage(stageId);

  return {
    headline,
    severityMode,
    continueReason,
    remainingBlockerLabels: blockers.map((b) => b.title),
    unlockHeadline,
    unlocks,
    blockers,
    primaryAction: refineGenericAction(primary.primaryAction, stageId, signals),
    primaryActionTab: primary.actionTab,
    openResolver: blockers.length > 0,
    clearPathMessage,
  };
}

function specificActionFromLabel(
  label: string,
  stageId: CampaignWorkspaceTabId
): string {
  const lower = label.toLowerCase();
  if (lower.includes("client approval") || lower.includes("client io approved")) {
    return "Open Client IO";
  }
  if (lower.includes("client io generated")) return "Generate Client IO";
  if (lower.includes("client io sent")) return "Send Client IO";
  if (lower.includes("vendor")) return "Open Vendor IO";
  if (lower.includes("assignment")) return "Complete Assignments";
  if (lower.includes("invoice")) return "Open Finance";
  if (lower.includes("deliverable")) return "Open Deliverables";
  if (stageId === "client-io") return "Open Client IO";
  if (stageId === "vendor-io") return "Open Vendor IO";
  if (stageId === "billing") return "Open Finance";
  if (stageId === "deliverables") return "Open Deliverables";
  if (stageId === "publications") return "Monitor Performance";
  if (stageId === "lines") return "Complete Assignments";
  return "Open Pending Approval";
}

/** Replace generic lifecycle verbs with specific CTAs. */
export function refineGenericAction(
  action: string,
  stageId: CampaignWorkspaceTabId,
  signals: CampaignProcessSignals
): string {
  const trimmed = action.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "resolve blockers" || lower === "resolve blocker") {
    if (signals.poExceeded) return "Review PO Limit";
    if (signals.clientIoStatus === "rejected") return "Review Client Feedback";
    if (
      signals.clientIoStatus === "sent" ||
      signals.clientIoStatus === "under_client_review"
    ) {
      return "Open Client IO";
    }
    if (signals.lineCount === 0) return "Complete Assignments";
    if (stageId === "client-io") return "Open Client IO";
    if (stageId === "vendor-io") return "Open Vendor IO";
    if (stageId === "billing") return "Open Finance";
    if (stageId === "deliverables") return "Open Deliverables";
    return "Open Pending Approval";
  }

  if (lower === "prepare client io") return "Generate Client IO";
  if (lower === "complete assignments") return "Complete Assignments";
  if (lower === "resolve client io rejection") return "Review Client Feedback";
  if (lower === "resolve overdue deliverables") return "Resolve Overdue Deliverables";
  if (lower === "follow up finance") return "Follow Up Finance";
  if (lower === "review finance") return "Review Finance";
  if (lower === "track deliverables") return "Track Deliverables";
  if (lower === "manage deliverables") return "Manage Deliverables";
  if (lower === "monitor performance") return "Monitor Performance";
  if (lower === "continue assignments") return "Continue Assignments";
  if (lower === "issue vendor io") return "Issue Vendor IO";
  if (lower === "follow up vendor io") return "Follow Up Vendor IO";
  if (lower === "review client io") return "Review Client IO";
  if (lower === "send client io") return "Send Client IO";
  if (lower === "review campaign status") return "Review Campaign Status";
  if (lower === "review close-out") return "Review Close-Out";
  if (lower === "review po limit") return "Review PO Limit";

  return trimmed;
}

/** Create Invoice only when Billing has started (or invoices already exist). */
export function isBillingInvoiceCreationUnlocked(input: {
  businessStageId: CampaignWorkspaceTabId;
  billingSignal: string | undefined;
  invoiceCount: number;
}): boolean {
  if (input.invoiceCount > 0) return true;
  if (input.businessStageId === "billing") return true;
  const signal = input.billingSignal ?? "upcoming";
  return signal !== "upcoming";
}
