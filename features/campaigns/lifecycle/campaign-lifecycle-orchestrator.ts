/**
 * Campaign Lifecycle Orchestrator — presentation only.
 * Derives business stage, state, requirements, next action, owners, health,
 * timeline, and workspace guidance from existing CampaignWorkspace fields.
 *
 * No API · DB · workflow · permission · calculation engine changes.
 */

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import {
  buildDecisionCenter,
  decisionObjectsFromWorkspace,
  refineGenericAction,
  type CampaignDecisionCenter,
} from "@/features/campaigns/lifecycle/campaign-decision-center";
import {
  BUSINESS_PROCESS_STAGES,
  getStagePolicy,
  type CampaignStagePolicy,
} from "@/features/campaigns/lifecycle/campaign-stage-policy";
import {
  deriveCampaignProcessCue,
  signalsFromCampaignListItem,
  signalsFromCampaignWorkspace,
  type CampaignProcessCue,
  type CampaignProcessSignals,
} from "@/features/campaigns/lifecycle/campaign-process-presentation";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import {
  businessStateLabel,
  waitingStateLabel,
  type BusinessState,
  type StageEnforcement,
} from "@/lib/business-process/business-state";
import type { BusinessProcessOwner, BusinessProcessWaitingParty } from "@/lib/business-process/types";
import type { CampaignListItem } from "@/types/database";

export type RequirementItem = {
  id: string;
  label: string;
  met: boolean;
};

export type CampaignHealthDimension =
  | "commercial"
  | "operations"
  | "delivery"
  | "finance"
  | "client"
  | "performance";

export type CampaignHealthSlice = {
  id: CampaignHealthDimension;
  label: string;
  state: BusinessState;
  labelDetail: string;
};

export type BusinessTimelineEvent = {
  id: string;
  label: string;
  at: string | null;
  occurred: boolean;
  owner: BusinessProcessOwner;
};

export type WorkspaceGuidance = {
  workspaceTab: CampaignWorkspaceTabId;
  workspaceLabel: string;
  /** Primary lifecycle context — always the campaign business stage. */
  businessStageLabel: string;
  businessStateLabel: string;
  whatHappened: string;
  currentSituation: string;
  nextAction: string;
  owner: BusinessProcessOwner;
  expectedResult: string;
  unlockHint: string | null;
  completedCount: number;
  missingCount: number;
  /** True when this workspace is ahead of / behind the business stage. */
  outOfBand: boolean;
};

export type CampaignReadinessItem = {
  id: string;
  label: string;
  state: BusinessState;
  detail: string;
};

export type CampaignLifecycleView = {
  /** Business stage (independent of which workspace tab is open). */
  businessStageId: CampaignWorkspaceTabId;
  businessStageLabel: string;
  businessState: BusinessState;
  businessStateLabel: string;
  owner: BusinessProcessOwner;
  waitingFor: BusinessProcessWaitingParty;
  waitingLabel: string;
  reason: string;
  expectedResult: string;
  nextAction: string;
  nextActionTab: CampaignWorkspaceTabId;
  nextStageLabel: string | null;
  enforcement: StageEnforcement;
  mandatory: boolean;
  requirements: RequirementItem[];
  blockers: string[];
  missing: string[];
  health: CampaignHealthSlice[];
  readiness: CampaignReadinessItem[];
  timeline: BusinessTimelineEvent[];
  /** Decision-first operating surface (blockers, unlocks, specific CTAs). */
  decisionCenter: CampaignDecisionCenter;
  /** Compatibility with Phase 1 BPN cue. */
  processCue: CampaignProcessCue;
  policy: CampaignStagePolicy;
  /** Vendor IO document count — used for truthful out-of-band guidance (STAB-011). */
  vendorIoCount: number;
};

/**
 * Map process cues to business states.
 * "Blocked" is reserved for hard stage enforcement only — soft cues become
 * Waiting / Needs Attention / In Progress.
 */
function toBusinessState(
  cue: CampaignProcessCue,
  signals: CampaignProcessSignals,
  policy: CampaignStagePolicy
): BusinessState {
  if (signals.status === "cancelled") return "closed";
  if (signals.status === "completed") return "completed";
  if (cue.lifecycleSignal === "completed") return "completed";

  if (cue.lifecycleSignal === "blocked") {
    return policy.enforcement === "hard" ? "blocked" : "needs_attention";
  }
  if (cue.lifecycleSignal === "attention_required") return "needs_attention";
  if (
    cue.lifecycleSignal === "waiting_client" ||
    cue.lifecycleSignal === "waiting_vendor" ||
    cue.lifecycleSignal === "waiting_internal"
  ) {
    return "waiting";
  }
  if (signals.status === "draft" && signals.lineCount === 0) return "draft";
  if (
    cue.nextActionLabel.toLowerCase().includes("review") &&
    cue.lifecycleSignal === "current"
  ) {
    return "ready";
  }
  if (cue.statusLabel.toLowerCase().includes("ready")) return "ready";
  return "in_progress";
}

function buildRequirements(
  signals: CampaignProcessSignals,
  stageId: CampaignWorkspaceTabId
): RequirementItem[] {
  const clientApproved = signals.clientIoStatus === "approved";
  const clientGenerated =
    Boolean(signals.clientIoStatus) && signals.clientIoStatus !== "draft";
  const clientSent =
    signals.clientIoStatus === "sent" ||
    signals.clientIoStatus === "under_client_review" ||
    clientApproved;
  const assignmentsCreated = signals.lineCount > 0;
  const vendorIssued = signals.vendorIoCount > 0;
  const vendorApproved =
    signals.vendorIoCount > 0 &&
    signals.approvedVendorIoCount >= signals.vendorIoCount;
  const deliverablesStarted = signals.deliverableCount > 0;
  const performanceActive = signals.activePerformance;
  const financeStarted = signals.invoiceCount > 0;

  const common: RequirementItem[] = [
    { id: "campaign", label: "Campaign created", met: true },
    { id: "assignments", label: "Assignments created", met: assignmentsCreated },
  ];

  switch (stageId) {
    case "lines":
      return [
        { id: "campaign", label: "Campaign created", met: true },
        { id: "assignments", label: "Assignments created", met: assignmentsCreated },
      ];
    case "client-io":
      return [
        ...common,
        { id: "cio_generated", label: "Client IO generated", met: clientGenerated },
        { id: "cio_sent", label: "Client IO sent", met: clientSent },
        { id: "cio_approved", label: "Client approval", met: clientApproved },
      ];
    case "vendor-io":
      return [
        ...common,
        { id: "cio_approved", label: "Client IO approved", met: clientApproved },
        { id: "vio_issued", label: "Vendor IO issued", met: vendorIssued },
        { id: "vio_approved", label: "Vendor approval", met: vendorApproved },
      ];
    case "deliverables":
      return [
        ...common,
        { id: "cio_approved", label: "Client IO approved", met: clientApproved },
        { id: "deliverables", label: "Deliverables in progress", met: deliverablesStarted },
      ];
    case "publications":
      return [
        ...common,
        {
          id: "deliverables",
          label: "Deliverables underway",
          met: deliverablesStarted,
        },
        { id: "performance", label: "Performance active", met: performanceActive },
      ];
    case "billing":
      return [
        ...common,
        { id: "cio_approved", label: "Client IO approved", met: clientApproved },
        { id: "invoices", label: "Invoices generated", met: financeStarted },
      ];
    default:
      return common;
  }
}

function buildReason(
  cue: CampaignProcessCue,
  state: BusinessState,
  blockers: string[]
): string {
  if (blockers.length > 0) {
    return blockers[0] ?? cue.statusLabel;
  }
  if (state === "waiting") {
    return `Campaign is waiting for ${cue.waitingFor === "None" ? "the next stakeholder" : cue.waitingFor}.`;
  }
  if (state === "draft") {
    return "Campaign was just created. No operational work is expected yet.";
  }
  if (state === "needs_attention") {
    return cue.statusLabel;
  }
  if (state === "blocked") {
    return cue.statusLabel;
  }
  if (state === "completed" || state === "closed") {
    return "Campaign has finished its operational lifecycle.";
  }
  return `Current focus is ${cue.currentStageLabel}: ${cue.statusLabel}.`;
}

function expectedResultFor(stageId: CampaignWorkspaceTabId): string {
  switch (stageId) {
    case "lines":
      return "Assignments ready for commercial packaging.";
    case "client-io":
      return "Client receives and approves commercial terms.";
    case "vendor-io":
      return "Vendors accept engagement terms.";
    case "deliverables":
      return "Creators submit approved content.";
    case "publications":
      return "Publications go live and metrics populate.";
    case "billing":
      return "Invoices posted and collections progress.";
    default:
      return "Campaign advances to the next lifecycle stage.";
  }
}

function softOrHardAttention(
  hard: boolean,
  softState: BusinessState
): BusinessState {
  return hard ? "blocked" : softState;
}

function buildHealth(signals: CampaignProcessSignals, cue: CampaignProcessCue): CampaignHealthSlice[] {
  const clientWaiting =
    signals.clientIoStatus === "sent" ||
    signals.clientIoStatus === "under_client_review";
  const clientRejected = signals.clientIoStatus === "rejected";
  const opsPolicy = getStagePolicy("lines");
  const cioPolicy = getStagePolicy("client-io");

  const slices: CampaignHealthSlice[] = [
    {
      id: "commercial",
      label: "Commercial",
      state: clientRejected
        ? softOrHardAttention(cioPolicy.enforcement === "hard", "needs_attention")
        : clientWaiting
          ? "waiting"
          : signals.clientIoStatus === "approved"
            ? "completed"
            : signals.lineCount > 0
              ? "in_progress"
              : "draft",
      labelDetail: clientWaiting
        ? "Waiting Client"
        : clientRejected
          ? "Needs attention"
          : signals.clientIoStatus === "approved"
            ? "Approved"
            : signals.lineCount > 0
              ? "In progress"
              : "Not started",
    },
    {
      id: "operations",
      label: "Operations",
      state:
        signals.blockerCount > 0 || signals.poExceeded
          ? softOrHardAttention(opsPolicy.enforcement === "hard", "needs_attention")
          : signals.lineCount === 0
            ? "in_progress"
            : "ready",
      labelDetail:
        signals.blockerCount > 0 || signals.poExceeded
          ? "Needs attention"
          : signals.lineCount === 0
            ? "Assignments incomplete"
            : "Healthy",
    },
    {
      id: "delivery",
      label: "Delivery",
      state:
        signals.overdueDeliverableCount > 0
          ? "needs_attention"
          : signals.deliverableCount > 0
            ? "in_progress"
            : "draft",
      labelDetail:
        signals.overdueDeliverableCount > 0
          ? "Overdue deliverables"
          : signals.deliverableCount > 0
            ? "In progress"
            : "Not started",
    },
    {
      id: "finance",
      label: "Finance",
      state:
        signals.billingOutstanding > 0
          ? "waiting"
          : signals.invoiceCount > 0
            ? "in_progress"
            : signals.clientIoStatus === "approved"
              ? "ready"
              : "draft",
      labelDetail:
        signals.billingOutstanding > 0
          ? "Waiting collection"
          : signals.invoiceCount > 0
            ? "In progress"
            : signals.clientIoStatus === "approved"
              ? "Ready"
              : "Not started",
    },
    {
      id: "client",
      label: "Client",
      state: clientWaiting
        ? "waiting"
        : clientRejected
          ? "needs_attention"
          : signals.clientIoStatus === "approved"
            ? "completed"
            : "draft",
      labelDetail: clientWaiting
        ? "Waiting Client"
        : clientRejected
          ? "Rejected"
          : signals.clientIoStatus === "approved"
            ? "Approved"
            : "Pending",
    },
    {
      id: "performance",
      label: "Performance",
      state: signals.activePerformance
        ? "in_progress"
        : signals.deliverableCount > 0
          ? "ready"
          : "draft",
      labelDetail: signals.activePerformance
        ? "Publications active"
        : signals.deliverableCount > 0
          ? "Ready for publish"
          : "Not started",
    },
  ];

  if (cue.lifecycleSignal === "attention_required") {
    return slices.map((slice) =>
      slice.id === "operations"
        ? { ...slice, state: "needs_attention", labelDetail: "Needs attention" }
        : slice
    );
  }

  return slices;
}

function buildReadiness(signals: CampaignProcessSignals): CampaignReadinessItem[] {
  return [
    {
      id: "commercial",
      label: "Commercial",
      state:
        signals.clientIoStatus === "approved"
          ? "completed"
          : signals.clientIoStatus
            ? "in_progress"
            : "draft",
      detail:
        signals.clientIoStatus === "approved"
          ? "✓"
          : signals.clientIoStatus
            ? "In progress"
            : "Pending",
    },
    {
      id: "operations",
      label: "Operations",
      state: signals.lineCount > 0 ? "completed" : "in_progress",
      detail: signals.lineCount > 0 ? "✓" : "Pending",
    },
    {
      id: "assignments",
      label: "Assignments",
      state: signals.lineCount > 0 ? "completed" : "draft",
      detail: signals.lineCount > 0 ? "✓" : "Pending",
    },
    {
      id: "budget",
      label: "Budget",
      state: signals.poExceeded ? "blocked" : "ready",
      detail: signals.poExceeded ? "PO exceeded" : "✓",
    },
    {
      id: "vendor",
      label: "Vendor",
      state:
        signals.vendorIoCount > 0 &&
        signals.approvedVendorIoCount >= signals.vendorIoCount
          ? "completed"
          : signals.vendorIoCount > 0
            ? "waiting"
            : "draft",
      detail:
        signals.vendorIoCount > 0 &&
        signals.approvedVendorIoCount >= signals.vendorIoCount
          ? "✓"
          : signals.vendorIoCount > 0
            ? "Waiting"
            : "Pending",
    },
    {
      id: "client",
      label: "Client",
      state:
        signals.clientIoStatus === "approved"
          ? "completed"
          : signals.clientIoStatus === "sent" ||
              signals.clientIoStatus === "under_client_review"
            ? "waiting"
            : "draft",
      detail:
        signals.clientIoStatus === "approved"
          ? "✓"
          : signals.clientIoStatus === "sent" ||
              signals.clientIoStatus === "under_client_review"
            ? "Pending"
            : "Pending",
    },
    {
      id: "finance",
      label: "Finance",
      state:
        signals.billingOutstanding > 0
          ? "waiting"
          : signals.invoiceCount > 0
            ? "in_progress"
            : signals.clientIoStatus === "approved"
              ? "ready"
              : "draft",
      detail:
        signals.billingOutstanding > 0
          ? "Waiting"
          : signals.invoiceCount > 0
            ? "In progress"
            : signals.clientIoStatus === "approved"
              ? "Ready"
              : "Pending",
    },
  ];
}

function buildBusinessTimeline(
  workspace: CampaignWorkspace | null,
  signals: CampaignProcessSignals
): BusinessTimelineEvent[] {
  const clientIo = workspace?.client_io ?? null;
  const firstInvoice = workspace?.invoices?.[0] ?? null;
  const paidInvoice = workspace?.invoices?.find((inv) => Number(inv.amount_paid) > 0);

  return [
    {
      id: "created",
      label: "Campaign Created",
      at: workspace?.id ? null : null,
      occurred: true,
      owner: "Operations",
    },
    {
      id: "assignments_created",
      label: "Assignments Created",
      at: null,
      occurred: signals.lineCount > 0,
      owner: "Operations",
    },
    {
      id: "assignments_completed",
      label: "Assignments Completed",
      at: null,
      // STAB-018: do not mark Done merely because lines exist (same as Created).
      occurred:
        signals.lineCount > 0 &&
        signals.vendorIoCount > 0 &&
        signals.approvedVendorIoCount >= signals.vendorIoCount,
      owner: "Operations",
    },
    {
      id: "cio_generated",
      label: "Client IO Generated",
      at: clientIo?.document_generated_at ?? null,
      occurred: Boolean(clientIo && clientIo.status !== "draft"),
      owner: "Commercial",
    },
    {
      id: "cio_sent",
      label: "Client IO Sent",
      at: clientIo?.sent_at ?? null,
      occurred:
        clientIo?.status === "sent" ||
        clientIo?.status === "under_client_review" ||
        clientIo?.status === "approved",
      owner: "Commercial",
    },
    {
      id: "cio_approved",
      label: "Client Approved",
      at: null,
      occurred: clientIo?.status === "approved",
      owner: "Client",
    },
    {
      id: "vio_generated",
      label: "Vendor IO Generated",
      at: null,
      occurred: signals.vendorIoCount > 0,
      owner: "Operations",
    },
    {
      id: "vendor_accepted",
      label: "Vendor Accepted",
      at: null,
      occurred:
        signals.vendorIoCount > 0 &&
        signals.approvedVendorIoCount >= signals.vendorIoCount,
      owner: "Vendor",
    },
    {
      id: "deliverables_uploaded",
      label: "Deliverables Uploaded",
      at: null,
      occurred: signals.deliverableCount > 0,
      owner: "Creator",
    },
    {
      id: "publication_live",
      label: "Publication Live",
      at: null,
      occurred: signals.activePerformance,
      owner: "Operations",
    },
    {
      id: "invoice_generated",
      label: "Invoice Generated",
      at: firstInvoice?.issue_date ?? null,
      occurred: signals.invoiceCount > 0,
      owner: "Finance",
    },
    {
      id: "invoice_paid",
      label: "Invoice Paid",
      at: null,
      occurred: Boolean(paidInvoice),
      owner: "Finance",
    },
    {
      id: "campaign_closed",
      label: "Campaign Closed",
      at: null,
      occurred: signals.status === "completed" || signals.status === "cancelled",
      owner: "Executive",
    },
  ];
}

function guidanceBase(
  lifecycle: CampaignLifecycleView,
  activeTab: CampaignWorkspaceTabId,
  workspaceLabel: string,
  partial: Pick<
    WorkspaceGuidance,
    "whatHappened" | "currentSituation" | "nextAction" | "owner" | "outOfBand" | "unlockHint"
  >
): WorkspaceGuidance {
  const completedCount = lifecycle.requirements.filter((item) => item.met).length;
  return {
    workspaceTab: activeTab,
    workspaceLabel,
    businessStageLabel: lifecycle.businessStageLabel,
    businessStateLabel: lifecycle.businessStateLabel,
    expectedResult: lifecycle.expectedResult,
    completedCount,
    missingCount: lifecycle.missing.length,
    ...partial,
  };
}

export function buildWorkspaceGuidance(
  lifecycle: CampaignLifecycleView,
  activeTab: CampaignWorkspaceTabId
): WorkspaceGuidance {
  const policy = getStagePolicy(activeTab);
  const outOfBand =
    !policy.crossCutting && activeTab !== lifecycle.businessStageId;

  if (policy.crossCutting) {
    return guidanceBase(lifecycle, activeTab, policy.label, {
      whatHappened: `Business stage remains ${lifecycle.businessStageLabel}.`,
      currentSituation: lifecycle.reason,
      nextAction: lifecycle.nextAction,
      owner: lifecycle.owner,
      unlockHint: null,
      outOfBand: false,
    });
  }

  const primary = lifecycle.decisionCenter.blockers[0] ?? null;
  const primaryRef = primary
    ? `${primary.objectLabel} ${primary.objectRef}`
    : lifecycle.businessStageLabel;
  const primaryAction = lifecycle.decisionCenter.primaryAction;

  if (activeTab === "billing") {
    const billingReady =
      lifecycle.processCue.stageSignals.billing === "completed" ||
      lifecycle.processCue.stageSignals.billing === "current" ||
      lifecycle.businessStageId === "billing";
    if (!billingReady && lifecycle.businessStageId !== "billing") {
      return guidanceBase(lifecycle, activeTab, "Finance", {
        whatHappened: `Invoice creation is disabled until Billing starts.`,
        currentSituation: primary
          ? `${primaryRef} is blocking Finance. ${primary.reason}`
          : "Complete the current stage before creating invoices.",
        nextAction: primaryAction,
        owner: lifecycle.owner,
        unlockHint: `Sending / Create Invoice stays disabled until ${primaryRef} is cleared.`,
        outOfBand: true,
      });
    }
  }

  if (activeTab === "publications") {
    const pubSignal = lifecycle.processCue.stageSignals.publications ?? "upcoming";
    if (
      lifecycle.businessStageId !== "publications" &&
      (pubSignal === "upcoming" || pubSignal === "waiting_internal")
    ) {
      return guidanceBase(lifecycle, activeTab, "Performance", {
        whatHappened: "Performance metrics unlock after publications go live.",
        currentSituation: primary
          ? `${primaryRef} · ${primary.waitingLabel}.`
          : "Advance delivery so creators can publish.",
        nextAction: primaryAction,
        owner: lifecycle.owner,
        unlockHint: primary
          ? `Open ${primary.objectRef} to continue toward Performance.`
          : "Open Deliverables to continue toward Performance.",
        outOfBand: true,
      });
    }
  }

  if (activeTab === "vendor-io") {
    if (
      lifecycle.processCue.stageSignals["client-io"] !== "completed" &&
      lifecycle.businessStageId === "client-io"
    ) {
      const cioBlocker =
        lifecycle.decisionCenter.blockers.find((b) => b.objectKind === "client_io") ??
        primary;
      const cioLabel = cioBlocker
        ? `${cioBlocker.objectLabel} ${cioBlocker.objectRef}`
        : "Client IO";
      // STAB-011: do not claim drafts are ready when zero Vendor IO records exist.
      const draftsExist = lifecycle.vendorIoCount > 0;
      return guidanceBase(lifecycle, activeTab, "Vendor IO", {
        whatHappened: draftsExist
          ? "Vendor IO drafts are ready."
          : "Vendor IO will be issued after Client IO approval.",
        currentSituation: `Sending is disabled until ${cioLabel} is approved.`,
        nextAction: cioBlocker?.primaryAction ?? "Open Client IO",
        owner: "Commercial",
        unlockHint: `Open ${cioLabel}`,
        outOfBand: true,
      });
    }
  }

  if (activeTab === "deliverables") {
    // Only true business blockers (e.g. Client IO) lock deliverables — never Vendor IO alone.
    const clientPending =
      lifecycle.businessStageId === "client-io" ||
      lifecycle.processCue.lifecycleSignal === "waiting_client";
    if (clientPending && lifecycle.businessStageId !== "deliverables") {
      const lockRef = primary
        ? `${primary.objectLabel} ${primary.objectRef}`
        : "Client IO";
      return guidanceBase(lifecycle, activeTab, "Deliverables", {
        whatHappened: "Deliverables stay locked until commercial approvals finish.",
        currentSituation: `Work is disabled until ${lockRef} clears.`,
        nextAction: primaryAction,
        owner: lifecycle.owner,
        unlockHint: `Open ${lockRef}`,
        outOfBand: true,
      });
    }
  }

  if (activeTab === "lines") {
    const lineSignal = lifecycle.processCue.stageSignals.lines;
    if (lineSignal === "completed" && lifecycle.businessStageId !== "lines") {
      return guidanceBase(lifecycle, activeTab, "Assignments", {
        whatHappened: "Assignments complete.",
        currentSituation: `Business stage has moved to ${lifecycle.businessStageLabel}.`,
        nextAction: primaryAction,
        owner: lifecycle.owner,
        unlockHint: null,
        outOfBand: true,
      });
    }
  }

  // In-band / non-locked views: no guidance banner (Decision Center owns the inbox).
  if (!outOfBand) {
    return guidanceBase(lifecycle, activeTab, policy.label, {
      whatHappened: "",
      currentSituation: "",
      nextAction: primaryAction,
      owner: lifecycle.owner,
      unlockHint: null,
      outOfBand: false,
    });
  }

  return guidanceBase(lifecycle, activeTab, policy.label, {
    whatHappened: `Viewing ${policy.label} while work is in ${lifecycle.businessStageLabel}.`,
    currentSituation: primary
      ? `${primaryRef} · Waiting: ${primary.waitingLabel}.`
      : `Return to ${lifecycle.businessStageLabel} to advance.`,
    nextAction: primaryAction,
    owner: lifecycle.owner,
    unlockHint: primary ? `Open ${primary.objectRef}` : `Open ${lifecycle.businessStageLabel}`,
    outOfBand: true,
  });
}

function deriveLifecycleFromSignals(
  signals: CampaignProcessSignals,
  workspace: CampaignWorkspace | null
): CampaignLifecycleView {
  const processCue = deriveCampaignProcessCue(signals);
  const policy = getStagePolicy(processCue.entryStageId);
  const businessState = toBusinessState(processCue, signals, policy);
  const requirements = buildRequirements(signals, processCue.entryStageId);
  const missing = requirements.filter((item) => !item.met).map((item) => item.label);

  // Hard blockers only — soft issues stay in missing / reason, never inflate "Blocked".
  const blockers: string[] = [];
  if (policy.enforcement === "hard") {
    if (signals.poExceeded) blockers.push("PO limit exceeded.");
    if (signals.blockerCount > 0) {
      const hardOnly = (workspace?.blockers ?? []).filter((text) =>
        // Prefer explicit hard progression strings; fall back to count signal.
        /pending approvals|po limit|contract required|approval required/i.test(text)
      );
      blockers.push(
        ...(hardOnly.length
          ? hardOnly
          : ["Open operational blockers require resolution."])
      );
    }
    if (signals.clientIoStatus === "rejected") {
      blockers.push("Client IO has been rejected.");
    }
  }

  const reasonHints: string[] = [];
  if (signals.poExceeded) reasonHints.push("PO limit exceeded.");
  if (signals.blockerCount > 0) {
    reasonHints.push(
      ...(workspace?.blockers?.length
        ? workspace.blockers
        : ["Open operational issues require attention."])
    );
  }
  if (signals.clientIoStatus === "rejected") {
    reasonHints.push("Client IO has been rejected.");
  }
  if (processCue.entryStageId === "client-io" && !signals.hasClientIo) {
    reasonHints.push("Client IO has not been generated.");
  }
  if (
    processCue.entryStageId === "client-io" &&
    signals.hasClientIo &&
    signals.clientIoStatus === "draft"
  ) {
    reasonHints.push("Client IO draft is incomplete — generate the document before send.");
  }
  if (
    processCue.entryStageId === "client-io" &&
    (signals.clientIoStatus === "sent" ||
      signals.clientIoStatus === "under_client_review")
  ) {
    reasonHints.push("Client approval is pending.");
  }
  if (signals.overdueDeliverableCount > 0) {
    reasonHints.push(`${signals.overdueDeliverableCount} deliverable(s) overdue.`);
  }
  for (const item of missing) {
    const sentence = `${item}.`;
    if (!reasonHints.some((hint) => hint.toLowerCase().includes(item.toLowerCase()))) {
      reasonHints.push(sentence);
    }
  }

  const waitingLabel =
    businessState === "waiting"
      ? waitingStateLabel(processCue.waitingFor)
      : businessStateLabel(businessState);

  const expectedResult = expectedResultFor(processCue.entryStageId);
  const refinedAction = refineGenericAction(
    processCue.nextActionLabel,
    processCue.entryStageId,
    signals
  );

  const draftView: Omit<CampaignLifecycleView, "decisionCenter"> = {
    businessStageId: processCue.entryStageId,
    businessStageLabel: processCue.currentStageLabel,
    businessState,
    businessStateLabel: waitingLabel,
    owner: processCue.owner,
    waitingFor: processCue.waitingFor,
    waitingLabel,
    reason: buildReason(processCue, businessState, reasonHints),
    expectedResult,
    nextAction: refinedAction,
    nextActionTab: processCue.entryStageId,
    nextStageLabel: processCue.nextStageLabel,
    enforcement: policy.enforcement,
    mandatory: policy.mandatory,
    requirements,
    blockers,
    missing,
    health: buildHealth(signals, processCue),
    readiness: buildReadiness(signals),
    timeline: buildBusinessTimeline(workspace, signals),
    processCue,
    policy,
    vendorIoCount: signals.vendorIoCount,
  };

  // Days waiting uses latest activity as a movement proxy (presentation only).
  const activityAt = workspace?.activity?.[0]?.created_at ?? null;
  let daysWaiting: number | null = null;
  if (
    activityAt &&
    (businessState === "waiting" ||
      businessState === "needs_attention" ||
      businessState === "blocked")
  ) {
    const from = new Date(activityAt);
    if (!Number.isNaN(from.getTime())) {
      daysWaiting = Math.max(
        0,
        Math.floor((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24))
      );
    }
  }

  const decisionCenter = buildDecisionCenter({
    stageId: processCue.entryStageId,
    stageLabel: processCue.currentStageLabel,
    businessState,
    enforcement: policy.enforcement,
    owner: processCue.owner,
    waitingFor: processCue.waitingFor,
    nextAction: refinedAction,
    nextActionTab: processCue.entryStageId,
    expectedResult,
    missing,
    hardBlockers: blockers,
    workspaceBlockers: workspace?.blockers ?? [],
    signals,
    daysWaiting,
    objects: workspace ? decisionObjectsFromWorkspace(workspace) : null,
  });

  return {
    ...draftView,
    nextAction: decisionCenter.primaryAction,
    nextActionTab: decisionCenter.primaryActionTab,
    decisionCenter,
  };
}

export function campaignLifecycleFromWorkspace(
  workspace: CampaignWorkspace
): CampaignLifecycleView {
  return deriveLifecycleFromSignals(signalsFromCampaignWorkspace(workspace), workspace);
}

export function campaignLifecycleFromListItem(
  campaign: CampaignListItem
): CampaignLifecycleView {
  return deriveLifecycleFromSignals(signalsFromCampaignListItem(campaign), null);
}

/** Test/helper entry for signal-level orchestration without a workspace fixture. */
export function deriveLifecycleForTest(
  signals: CampaignProcessSignals
): CampaignLifecycleView {
  return deriveLifecycleFromSignals(signals, null);
}

export function workspaceLabelForTab(tabId: CampaignWorkspaceTabId): string {
  return getStagePolicy(tabId).label;
}

export { BUSINESS_PROCESS_STAGES };
