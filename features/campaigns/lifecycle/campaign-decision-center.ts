/**
 * Decision Center — presentation-only operational inbox for Lifecycle OS.
 * Every item references a concrete business object (ID / document number).
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

export type DecisionObjectKind =
  | "client_io"
  | "vendor_io"
  | "assignment"
  | "deliverable"
  | "invoice"
  | "po"
  | "campaign"
  | "creator";

export type DecisionFocusQuery = {
  key:
    | "io"
    | "docsCreator"
    | "line"
    | "invoice"
    | "deliverable"
    | "approval"
    | "publication"
    | "payment"
    | "activity";
  value: string;
};

export type DecisionBlocker = {
  id: string;
  objectKind: DecisionObjectKind;
  /** Business object type label — e.g. "Client IO". */
  objectLabel: string;
  /** Exact ID / document number — e.g. "#CIO-2026-0003". */
  objectRef: string;
  recordId: string | null;
  /** Short issue name — e.g. "Client Approval". */
  title: string;
  severity: DecisionSeverity;
  owner: BusinessProcessOwner;
  waitingFor: BusinessProcessWaitingParty | "None";
  /** Who/what is waited on — e.g. creator name or "Client Approval". */
  waitingLabel: string;
  sinceLabel: string;
  /** Why this object is stuck (one line). */
  reason: string;
  /** Alias of reason — kept for resolver / tests. */
  whyBlocks: string;
  /** Business impact if unresolved. */
  impact: string;
  /** What unlocks after the fix. */
  unlockLabel: string;
  primaryAction: string;
  actionTab: CampaignWorkspaceTabId;
  focusQuery: DecisionFocusQuery | null;
  relatedLabel: string | null;
  expectedResult: string;
};

export type UnlockPreview = {
  id: string;
  label: string;
};

export type CampaignDecisionCenter = {
  /** Operational count / clear posture — never a lifecycle essay. */
  headline: string;
  severityMode: "hard" | "attention" | "waiting" | "clear" | "progress";
  /** Resolver / a11y — not shown in the inbox strip. */
  continueReason: string;
  remainingBlockerLabels: string[];
  unlockHeadline: string;
  unlocks: UnlockPreview[];
  blockers: DecisionBlocker[];
  primaryAction: string;
  primaryActionTab: CampaignWorkspaceTabId;
  primaryFocusQuery: DecisionFocusQuery | null;
  openResolver: boolean;
  clearPathMessage: string;
};

/** Lightweight object snapshot — presentation only (from CampaignWorkspace). */
export type DecisionCenterObjects = {
  clientIo: {
    id: string;
    document_number: string | null;
    status: string | null;
  } | null;
  vendorIos: Array<{
    id: string;
    document_number: string | null;
    status: string;
    influencer_name: string;
  }>;
  lines: Array<{
    id: string;
    document_number: string;
    influencer_name: string | null;
  }>;
  deliverables: Array<{
    id: string;
    document_number: string;
    title: string;
    display_status: string;
    influencer_name: string;
    due_date: string | null;
  }>;
  invoices: Array<{
    id: string;
    document_number: string;
    outstanding: number;
    status: string;
  }>;
  campaignDocumentNumber: string | null;
};

export const DECISION_CLEAR_PATH_MESSAGE =
  "No operational items. Campaign is progressing normally.";

const FOCUS_PARAM_KEYS = [
  "io",
  "docsCreator",
  "line",
  "invoice",
  "deliverable",
  "approval",
  "publication",
  "payment",
  "activity",
] as const;

function daysLabel(daysWaiting: number | null | undefined): string {
  if (daysWaiting == null) return "—";
  if (daysWaiting <= 0) return "Today";
  if (daysWaiting === 1) return "1 day";
  return `${daysWaiting} days`;
}

function hashRef(documentNumber: string | null | undefined, fallback: string): string {
  const trimmed = documentNumber?.trim();
  if (!trimmed) return fallback;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function isVendorApproved(status: string): boolean {
  return status.toLowerCase().includes("approv");
}

function isDeliverableOverdue(row: DecisionCenterObjects["deliverables"][number]): boolean {
  if (!row.due_date) return false;
  const status = row.display_status.toLowerCase();
  if (status === "posted" || status === "approved") return false;
  const due = new Date(row.due_date);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function deliverableWaitingLabel(row: DecisionCenterObjects["deliverables"][number]): string {
  const status = row.display_status.toLowerCase();
  if (status === "rejected") return "Revision required";
  if (status === "pending") return "Story not submitted";
  if (status === "submitted") return "Review pending";
  return "Overdue";
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

function waitingPartyFromOwner(
  owner: BusinessProcessOwner
): BusinessProcessWaitingParty {
  if (owner === "Executive") return "Operations";
  return owner;
}

function resolveWaitingFor(
  waitingFor: BusinessProcessWaitingParty,
  owner: BusinessProcessOwner
): BusinessProcessWaitingParty {
  return waitingFor === "None" ? waitingPartyFromOwner(owner) : waitingFor;
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

function makeBlocker(
  partial: Omit<
    DecisionBlocker,
    "whyBlocks" | "waitingLabel" | "impact" | "unlockLabel"
  > & {
    waitingLabel?: string;
    whyBlocks?: string;
    impact?: string;
    unlockLabel?: string;
  }
): DecisionBlocker {
  const reason = partial.reason;
  return {
    ...partial,
    waitingLabel: partial.waitingLabel ?? String(partial.waitingFor),
    whyBlocks: partial.whyBlocks ?? reason,
    impact: partial.impact ?? reason,
    unlockLabel: partial.unlockLabel ?? partial.expectedResult,
  };
}

/**
 * Build structured Decision Center items from lifecycle signals + workspace objects.
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
  objects?: DecisionCenterObjects | null;
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
    objects = null,
  } = input;

  const since = daysLabel(daysWaiting);
  const blockers: DecisionBlocker[] = [];
  const hard = enforcement === "hard";
  const cio = objects?.clientIo ?? null;
  const cioRef = hashRef(cio?.document_number, "Client IO");
  const cioFocus: DecisionFocusQuery | null = cio
    ? { key: "io", value: cio.id }
    : null;

  if (signals.poExceeded) {
    pushUnique(
      blockers,
      makeBlocker({
        id: "po_exceeded",
        objectKind: "po",
        objectLabel: "Purchase Order",
        objectRef: hashRef(objects?.campaignDocumentNumber, "PO"),
        recordId: null,
        title: "PO limit exceeded",
        severity: "hard",
        owner: "Finance",
        waitingFor: "Finance",
        waitingLabel: "PO capacity",
        sinceLabel: since,
        reason: "Commercial spend exceeds the purchase-order ceiling.",
        primaryAction: "Review PO Limit",
        actionTab: "billing",
        focusQuery: null,
        relatedLabel: null,
        expectedResult: "PO capacity restored so commercial work can continue.",
      })
    );
  }

  if (signals.clientIoStatus === "rejected") {
    pushUnique(
      blockers,
      makeBlocker({
        id: "cio_rejected",
        objectKind: "client_io",
        objectLabel: "Client IO",
        objectRef: cioRef,
        recordId: cio?.id ?? null,
        title: "Waiting for Client Feedback review",
        severity: hard ? "hard" : "attention",
        owner: "Commercial",
        waitingFor: "Commercial",
        waitingLabel: "Client Feedback",
        sinceLabel: since,
        reason: `Rework ${cioRef} — Vendor IO send stays disabled until approved.`,
        primaryAction: `Review ${cioRef}`,
        actionTab: "client-io",
        focusQuery: cioFocus,
        relatedLabel: null,
        expectedResult: "Revised Client IO ready for re-approval.",
      })
    );
  }

  const waitingClient =
    signals.clientIoStatus === "sent" ||
    signals.clientIoStatus === "under_client_review";

  if (waitingClient) {
    // Single narrative: Client approval is the blocker; Vendor IO impact is stated once.
    pushUnique(
      blockers,
      makeBlocker({
        id: "cio_pending",
        objectKind: "client_io",
        objectLabel: "Client Approval",
        objectRef: cioRef,
        recordId: cio?.id ?? null,
        title: "Client approval pending",
        severity: "attention",
        owner: "Commercial",
        waitingFor: "Client",
        waitingLabel: "Client",
        sinceLabel: since,
        reason: "Client has not approved commercial terms.",
        impact: "Vendor IO cannot be sent until Client IO is approved.",
        unlockLabel: "Vendor IO send unlocks for creators.",
        primaryAction: `Open ${cioRef}`,
        actionTab: "client-io",
        focusQuery: cioFocus,
        relatedLabel: null,
        expectedResult: "Client approval unlocks Vendor IO issuance.",
      })
    );
  }

  if (
    stageId === "client-io" &&
    (!signals.hasClientIo ||
      !signals.clientIoStatus ||
      signals.clientIoStatus === "draft")
  ) {
    pushUnique(
      blockers,
      makeBlocker({
        id: "cio_generate",
        objectKind: "client_io",
        objectLabel: "Client IO",
        objectRef: cioRef,
        recordId: cio?.id ?? null,
        title: "Waiting for Client IO generation",
        severity: "attention",
        owner: "Commercial",
        waitingFor: "Commercial",
        waitingLabel: "Generation",
        sinceLabel: since,
        reason: "Generate Client IO to package commercial terms for approval.",
        primaryAction: cio ? `Open ${cioRef}` : "Generate Client IO",
        actionTab: "client-io",
        focusQuery: cioFocus,
        relatedLabel: null,
        expectedResult: "Client IO ready to send for approval.",
      })
    );
  }

  if (stageId === "client-io" && signals.clientIoStatus === "generated") {
    pushUnique(
      blockers,
      makeBlocker({
        id: "cio_send",
        objectKind: "client_io",
        objectLabel: "Client IO",
        objectRef: cioRef,
        recordId: cio?.id ?? null,
        title: "Waiting to send Client IO",
        severity: "attention",
        owner: "Commercial",
        waitingFor: "Commercial",
        waitingLabel: "Send",
        sinceLabel: since,
        reason: `Send ${cioRef} so the client can approve commercial terms.`,
        primaryAction: `Send ${cioRef}`,
        actionTab: "client-io",
        focusQuery: cioFocus,
        relatedLabel: null,
        expectedResult: "Client review begins after send.",
      })
    );
  }

  if (signals.lineCount === 0 && signals.status !== "cancelled" && signals.status !== "completed") {
    const campaignRef = hashRef(objects?.campaignDocumentNumber, "Campaign");
    pushUnique(
      blockers,
      makeBlocker({
        id: "assignments",
        objectKind: "assignment",
        objectLabel: "Assignments",
        objectRef: campaignRef,
        recordId: null,
        title: "Waiting for first assignment",
        severity: "attention",
        owner: "Operations",
        waitingFor: "Operations",
        waitingLabel: "Assignments",
        sinceLabel: since,
        reason: "Complete Assignments before Client IO can be prepared.",
        primaryAction: "Open Assignments",
        actionTab: "lines",
        focusQuery: null,
        relatedLabel: null,
        expectedResult: "Assignments ready for Client IO packaging.",
      })
    );
  } else if (objects?.lines?.length) {
    const incomplete = objects.lines.find((line) => !line.influencer_name);
    if (incomplete && stageId === "lines") {
      const lineRef = hashRef(incomplete.document_number, "Assignment");
      pushUnique(
        blockers,
        makeBlocker({
          id: `assignment_${incomplete.id}`,
          objectKind: "assignment",
          objectLabel: "Assignment",
          objectRef: lineRef,
          recordId: incomplete.id,
          title: "Waiting for vendor assignment",
          severity: "attention",
          owner: "Operations",
          waitingFor: "Operations",
          waitingLabel: "Vendor link",
          sinceLabel: since,
          reason: `${lineRef} has no linked creator.`,
          primaryAction: `Open ${lineRef}`,
          actionTab: "lines",
          focusQuery: { key: "line", value: incomplete.id },
          relatedLabel: null,
          expectedResult: "Assignment linked and ready for Client IO.",
        })
      );
    }
  }

  if (
    signals.clientIoStatus === "approved" &&
    signals.vendorIoCount === 0 &&
    stageId === "vendor-io"
  ) {
    pushUnique(
      blockers,
      makeBlocker({
        id: "vio_issue",
        objectKind: "vendor_io",
        objectLabel: "Vendor IO",
        objectRef: "Vendor IO",
        recordId: null,
        title: "Waiting for Vendor IO issuance",
        severity: "attention",
        owner: "Operations",
        waitingFor: "Operations",
        waitingLabel: "Issuance",
        sinceLabel: since,
        reason: `${cioRef} is approved — issue Vendor IO so creators can confirm.`,
        primaryAction: "Issue Vendor IO",
        actionTab: "vendor-io",
        focusQuery: null,
        relatedLabel: null,
        expectedResult: "Vendor IO ready to send for approval.",
      })
    );
  }

  if (
    signals.clientIoStatus === "approved" &&
    signals.vendorIoCount > 0 &&
    signals.approvedVendorIoCount < signals.vendorIoCount
  ) {
    const pendingRows = (objects?.vendorIos ?? []).filter(
      (row) => !isVendorApproved(row.status)
    );
    const pending =
      pendingRows.length > 0
        ? pendingRows.length
        : signals.vendorIoCount - signals.approvedVendorIoCount;
    const first = pendingRows[0] ?? null;
    const vioRef = first
      ? hashRef(first.document_number, "Vendor IO")
      : `${pending} pending`;
    // One summary card for many creators — never dump dozens into Decision Center.
    pushUnique(
      blockers,
      makeBlocker({
        id: first ? `vio_pending_${first.id}` : "vio_pending",
        objectKind: "vendor_io",
        objectLabel: "Vendor Approval",
        objectRef:
          pending === 1
            ? vioRef
            : `${pending} Vendor IOs`,
        recordId: first?.id ?? null,
        title: "Vendor acceptance pending",
        severity: "attention",
        owner: "Operations",
        waitingFor: "Vendor",
        waitingLabel:
          pending === 1
            ? first?.influencer_name ?? "Vendor"
            : `${first?.influencer_name ?? "Vendors"} +${pending - 1}`,
        sinceLabel: since,
        reason:
          pending === 1
            ? "Vendor has not accepted terms."
            : `${pending} creators have not accepted Vendor IO terms.`,
        impact: "Deliverables cannot start until Vendor IO is accepted.",
        unlockLabel: "Deliverable uploads unlock after acceptance.",
        primaryAction:
          pending === 1 && first ? `Open ${vioRef}` : "Open Vendor IO",
        actionTab: "vendor-io",
        focusQuery: first ? { key: "io", value: first.id } : null,
        relatedLabel:
          pending > 1 ? `${pending} creators` : first?.influencer_name ?? null,
        expectedResult: "Vendor approval unlocks deliverable work.",
      })
    );
  }

  const overdueRows = (objects?.deliverables ?? []).filter(isDeliverableOverdue);
  if (overdueRows.length === 1) {
    const row = overdueRows[0]!;
    const delRef = hashRef(row.document_number, "Deliverable");
    const waiting = deliverableWaitingLabel(row);
    pushUnique(
      blockers,
      makeBlocker({
        id: `deliverable_overdue_${row.id}`,
        objectKind: "deliverable",
        objectLabel: "Deliverable",
        objectRef: delRef,
        recordId: row.id,
        title: waiting === "Overdue" ? "Deliverable overdue" : waiting,
        severity: "attention",
        owner: "Operations",
        waitingFor: "Operations",
        waitingLabel: row.influencer_name || waiting,
        sinceLabel: since,
        reason: `${waiting} — ${row.title || row.display_status}.`,
        impact: "Performance tracking and billing may slip.",
        unlockLabel: "Delivery schedule returns on track.",
        primaryAction: `Open ${delRef}`,
        actionTab: "deliverables",
        focusQuery: { key: "deliverable", value: row.id },
        relatedLabel: row.influencer_name,
        expectedResult: "Delivery schedule back on track.",
      })
    );
  } else if (overdueRows.length > 1) {
    const first = overdueRows[0]!;
    pushUnique(
      blockers,
      makeBlocker({
        id: "deliverables_overdue",
        objectKind: "deliverable",
        objectLabel: "Deliverables",
        objectRef: `${overdueRows.length} overdue`,
        recordId: first.id,
        title: "Deliverables overdue",
        severity: "attention",
        owner: "Operations",
        waitingFor: "Operations",
        waitingLabel: `${first.influencer_name} +${overdueRows.length - 1}`,
        sinceLabel: since,
        reason: `${overdueRows.length} deliverables are past due.`,
        impact: "Performance tracking and billing may slip.",
        unlockLabel: "Delivery schedule returns on track.",
        primaryAction: "Open Deliverables",
        actionTab: "deliverables",
        focusQuery: { key: "deliverable", value: first.id },
        relatedLabel: `${overdueRows.length} deliverables`,
        expectedResult: "Delivery schedule back on track.",
      })
    );
  } else if (signals.overdueDeliverableCount > 0) {
    pushUnique(
      blockers,
      makeBlocker({
        id: "deliverables_overdue",
        objectKind: "deliverable",
        objectLabel: "Deliverables",
        objectRef: `${signals.overdueDeliverableCount} overdue`,
        recordId: null,
        title: "Deliverables overdue",
        severity: "attention",
        owner: "Operations",
        waitingFor: "Operations",
        waitingLabel: "Overdue",
        sinceLabel: since,
        reason: `${signals.overdueDeliverableCount} deliverable${
          signals.overdueDeliverableCount === 1 ? "" : "s"
        } past due.`,
        primaryAction: "Open Deliverables",
        actionTab: "deliverables",
        focusQuery: null,
        relatedLabel: null,
        expectedResult: "Delivery schedule back on track.",
      })
    );
  }

  if (
    stageId === "billing" &&
    signals.invoiceCount === 0 &&
    signals.billingOutstanding <= 0 &&
    signals.clientIoStatus === "approved"
  ) {
    pushUnique(
      blockers,
      makeBlocker({
        id: "finance_start",
        objectKind: "invoice",
        objectLabel: "Finance",
        objectRef: "Invoice",
        recordId: null,
        title: "Waiting for first invoice",
        severity: "attention",
        owner: "Finance",
        waitingFor: "Finance",
        waitingLabel: "Invoice generation",
        sinceLabel: since,
        reason: "Generate the first invoice to start collections.",
        primaryAction: "Open Finance",
        actionTab: "billing",
        focusQuery: null,
        relatedLabel: null,
        expectedResult: "Invoice generation unlocked.",
      })
    );
  }

  if (stageId === "billing" && signals.billingOutstanding > 0) {
    const openInvoice = (objects?.invoices ?? []).find((inv) => inv.outstanding > 0);
    const invRef = openInvoice
      ? hashRef(openInvoice.document_number, "Invoice")
      : "Invoice";
    pushUnique(
      blockers,
      makeBlocker({
        id: openInvoice ? `invoice_${openInvoice.id}` : "finance_collection",
        objectKind: "invoice",
        objectLabel: "Invoice",
        objectRef: invRef,
        recordId: openInvoice?.id ?? null,
        title: "Waiting for Payment",
        severity: "attention",
        owner: "Finance",
        waitingFor: "Finance",
        waitingLabel: "Payment",
        sinceLabel: since,
        reason: openInvoice
          ? `${invRef} has an outstanding balance.`
          : "Outstanding balances need Finance follow-up.",
        primaryAction: openInvoice ? `Open ${invRef}` : "Open Finance",
        actionTab: "billing",
        focusQuery: openInvoice
          ? { key: "invoice", value: openInvoice.id }
          : null,
        relatedLabel: null,
        expectedResult: "Collections progress toward close-out.",
      })
    );
  }

  for (const [index, text] of workspaceBlockers.entries()) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (
      blockers.some(
        (b) =>
          (lower.includes("client") && b.objectKind === "client_io") ||
          (lower.includes("vendor") && b.objectKind === "vendor_io") ||
          (lower.includes("po") && b.objectKind === "po") ||
          (lower.includes("deliverable") && b.objectKind === "deliverable") ||
          (lower.includes("invoice") && b.objectKind === "invoice")
      )
    ) {
      continue;
    }
    const tab = actionTabFromLabel(trimmed, nextActionTab);
    pushUnique(
      blockers,
      makeBlocker({
        id: `workspace_blocker_${index}`,
        objectKind: "campaign",
        objectLabel: "Campaign issue",
        objectRef: hashRef(objects?.campaignDocumentNumber, "Campaign"),
        recordId: null,
        title: trimmed.replace(/\.$/, ""),
        severity: hard || hardBlockers.length > 0 ? "hard" : "attention",
        owner,
        waitingFor: resolveWaitingFor(waitingFor, owner),
        waitingLabel: "Resolution",
        sinceLabel: since,
        reason: trimmed,
        primaryAction: specificActionFromLabel(trimmed, tab),
        actionTab: tab,
        focusQuery: tab === "client-io" ? cioFocus : null,
        relatedLabel: null,
        expectedResult,
      })
    );
  }

  for (const label of missing) {
    const lower = label.toLowerCase();
    if (
      blockers.some(
        (b) =>
          b.title.toLowerCase().includes(lower) ||
          lower.includes(b.objectLabel.toLowerCase()) ||
          lower.includes(b.title.toLowerCase().slice(0, 12))
      )
    ) {
      continue;
    }
    if (lower.includes("campaign created")) continue;
    if (lower.includes("client") && blockers.some((b) => b.objectKind === "client_io")) {
      continue;
    }
    if (lower.includes("vendor") && blockers.some((b) => b.objectKind === "vendor_io")) {
      continue;
    }
    const tab = actionTabFromLabel(label, stageId);
    pushUnique(
      blockers,
      makeBlocker({
        id: `missing_${label.toLowerCase().replace(/\s+/g, "_")}`,
        objectKind:
          tab === "client-io"
            ? "client_io"
            : tab === "vendor-io"
              ? "vendor_io"
              : tab === "billing"
                ? "invoice"
                : tab === "deliverables"
                  ? "deliverable"
                  : tab === "lines"
                    ? "assignment"
                    : "campaign",
        objectLabel: label,
        objectRef:
          tab === "client-io"
            ? cioRef
            : hashRef(objects?.campaignDocumentNumber, label),
        recordId: tab === "client-io" ? cio?.id ?? null : null,
        title: `Waiting for ${label}`,
        severity: "attention",
        owner,
        waitingFor: resolveWaitingFor(waitingFor, owner),
        waitingLabel: label,
        sinceLabel: since,
        reason: `Complete ${label} to finish ${stageLabel}.`,
        primaryAction: specificActionFromLabel(label, stageId),
        actionTab: tab,
        focusQuery: tab === "client-io" ? cioFocus : null,
        relatedLabel: null,
        expectedResult,
      })
    );
  }

  const hardItems = blockers.filter((b) => b.severity === "hard");
  const attentionItems = blockers.filter((b) => b.severity === "attention");

  let severityMode: CampaignDecisionCenter["severityMode"] = "progress";
  const issueWord = hardItems.length > 0 ? "Critical Issue" : "Operational Item";
  let headline =
    blockers.length === 0
      ? `Working in ${stageLabel}`
      : `${issueWord}${blockers.length === 1 ? "" : "s"} (${blockers.length})`;

  if (businessState === "blocked" || hardItems.length > 0) {
    severityMode = "hard";
  } else if (businessState === "needs_attention" || attentionItems.length > 0) {
    severityMode = "attention";
  } else if (businessState === "waiting") {
    severityMode = "waiting";
  } else if (businessState === "completed" || businessState === "closed") {
    severityMode = "clear";
    headline = "Campaign lifecycle complete";
  } else if (businessState === "draft") {
    severityMode = blockers.length > 0 ? "attention" : "progress";
    if (blockers.length === 0) headline = "Campaign draft";
  } else if (blockers.length === 0) {
    severityMode = "clear";
  }

  const refinedFallback = refineGenericAction(nextAction, stageId, signals);
  const primary = blockers[0]
    ? {
        primaryAction: blockers[0].primaryAction,
        actionTab: blockers[0].actionTab,
        focusQuery: blockers[0].focusQuery,
      }
    : {
        primaryAction: refinedFallback,
        actionTab: nextActionTab,
        focusQuery: null as DecisionFocusQuery | null,
      };

  const clearPathMessage =
    businessState === "completed" || businessState === "closed"
      ? "No operational items. Campaign lifecycle is complete."
      : DECISION_CLEAR_PATH_MESSAGE;

  const continueReason =
    blockers.length > 0
      ? blockers[0].reason
      : businessState === "waiting"
        ? `Waiting for ${waitingFor === "None" ? "the next stakeholder" : waitingFor}.`
        : clearPathMessage;

  const { headline: unlockHeadline, unlocks } = unlocksForStage(stageId);

  return {
    headline,
    severityMode,
    continueReason,
    remainingBlockerLabels: blockers.map(
      (b) => `${b.objectLabel} ${b.objectRef} · ${b.waitingLabel}`
    ),
    unlockHeadline,
    unlocks,
    blockers,
    primaryAction: primary.primaryAction,
    primaryActionTab: primary.actionTab,
    primaryFocusQuery: primary.focusQuery,
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
  if (lower.includes("assignment")) return "Open Assignments";
  if (lower.includes("invoice")) return "Open Finance";
  if (lower.includes("deliverable")) return "Open Deliverables";
  if (stageId === "client-io") return "Open Client IO";
  if (stageId === "vendor-io") return "Open Vendor IO";
  if (stageId === "billing") return "Open Finance";
  if (stageId === "deliverables") return "Open Deliverables";
  if (stageId === "publications") return "Open Performance";
  if (stageId === "lines") return "Open Assignments";
  return "Open record";
}

/** Replace generic lifecycle verbs with specific CTAs. */
export function refineGenericAction(
  action: string,
  stageId: CampaignWorkspaceTabId,
  signals: CampaignProcessSignals
): string {
  const trimmed = action.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower === "resolve blockers" ||
    lower === "resolve blocker" ||
    lower === "open pending approval"
  ) {
    if (signals.poExceeded) return "Review PO Limit";
    if (signals.clientIoStatus === "rejected") return "Review Client IO";
    if (
      signals.clientIoStatus === "sent" ||
      signals.clientIoStatus === "under_client_review"
    ) {
      return "Open Client IO";
    }
    if (signals.lineCount === 0) return "Open Assignments";
    if (
      signals.clientIoStatus === "approved" &&
      signals.approvedVendorIoCount < signals.vendorIoCount
    ) {
      return "Open Vendor IO";
    }
    if (stageId === "client-io") return "Open Client IO";
    if (stageId === "vendor-io") return "Open Vendor IO";
    if (stageId === "billing") return "Open Finance";
    if (stageId === "deliverables") return "Open Deliverables";
    return "Open record";
  }

  if (lower === "prepare client io") return "Generate Client IO";
  if (lower === "complete assignments") return "Open Assignments";
  if (lower === "continue assignments") return "Open Assignments";
  if (lower === "resolve client io rejection") return "Review Client IO";
  if (lower === "review client feedback") return "Review Client IO";
  if (lower === "resolve overdue deliverables") return "Open Deliverables";
  if (lower === "follow up finance") return "Open Finance";
  if (lower === "review finance") return "Open Finance";
  if (lower === "track deliverables") return "Open Deliverables";
  if (lower === "manage deliverables") return "Open Deliverables";
  if (lower === "monitor performance") return "Open Performance";
  if (lower === "issue vendor io") return "Issue Vendor IO";
  if (lower === "follow up vendor io") return "Open Vendor IO";
  if (lower === "review client io") return "Open Client IO";
  if (lower === "send client io") return "Send Client IO";
  if (lower === "review campaign status") return "Open Overview";
  if (lower === "review close-out") return "Open Overview";
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

/** Build object snapshot from a campaign workspace row (presentation only). */
export function decisionObjectsFromWorkspace(workspace: {
  document_number?: string | null;
  client_io?: DecisionCenterObjects["clientIo"];
  vendor_ios?: DecisionCenterObjects["vendorIos"];
  lines?: Array<{
    id: string;
    document_number: string;
    influencer_name: string | null;
  }>;
  deliverables?: DecisionCenterObjects["deliverables"];
  invoices?: DecisionCenterObjects["invoices"];
}): DecisionCenterObjects {
  return {
    clientIo: workspace.client_io
      ? {
          id: workspace.client_io.id,
          document_number: workspace.client_io.document_number,
          status: workspace.client_io.status,
        }
      : null,
    vendorIos: (workspace.vendor_ios ?? []).map((row) => ({
      id: row.id,
      document_number: row.document_number,
      status: row.status,
      influencer_name: row.influencer_name,
    })),
    lines: (workspace.lines ?? []).map((row) => ({
      id: row.id,
      document_number: row.document_number,
      influencer_name: row.influencer_name,
    })),
    deliverables: (workspace.deliverables ?? []).map((row) => ({
      id: row.id,
      document_number: row.document_number,
      title: row.title,
      display_status: row.display_status,
      influencer_name: row.influencer_name,
      due_date: row.due_date,
    })),
    invoices: (workspace.invoices ?? []).map((row) => ({
      id: row.id,
      document_number: row.document_number,
      outstanding: row.outstanding,
      status: row.status,
    })),
    campaignDocumentNumber: workspace.document_number ?? null,
  };
}

/** Append / replace focus query params when navigating from Decision Center. */
export function applyDecisionFocusToSearch(
  currentSearch: string,
  focus: DecisionFocusQuery | null | undefined
): string {
  const raw = currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch;
  const params = new URLSearchParams(raw);
  for (const key of FOCUS_PARAM_KEYS) {
    params.delete(key);
  }
  if (focus?.key && focus.value) {
    params.set(focus.key, focus.value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
