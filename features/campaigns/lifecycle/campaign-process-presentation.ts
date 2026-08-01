/**
 * Campaign adapter for Business Process Navigation (Architecture v1.0 Phase 1).
 * Presentation only — no API · DB · workflow · permission · calculation changes.
 *
 * Stage definitions are data-driven so future campaign types can filter/skip stages
 * without changing the reusable process model.
 */

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import {
  nextStageAfter,
  withRailSignals,
} from "@/lib/business-process/rail-signals";
import type {
  BusinessProcessLifecycleSignal,
  BusinessProcessOwner,
  BusinessProcessProgress,
  BusinessProcessStageDefinition,
  BusinessProcessWaitingParty,
} from "@/lib/business-process/types";
import { lifecycleSignalLabel } from "@/lib/business-process/types";
import type { CampaignListItem, CampaignStatus } from "@/types/database";

/** Practical process-rail stages (doc 12 clusters). Cross-cutting tabs stay navigable. */
export const CAMPAIGN_PROCESS_STAGES: readonly BusinessProcessStageDefinition<CampaignWorkspaceTabId>[] =
  [
    {
      id: "overview",
      label: "Overview",
      canonicalRef: "S00–S01",
      owner: "Operations",
    },
    {
      id: "lines",
      label: "Assignments",
      canonicalRef: "S06",
      owner: "Operations",
    },
    {
      id: "client-io",
      label: "Client IO",
      canonicalRef: "S07–S08",
      owner: "Commercial",
    },
    {
      id: "vendor-io",
      label: "Vendor IO",
      canonicalRef: "S09–S10",
      owner: "Operations",
    },
    {
      id: "deliverables",
      label: "Deliverables",
      canonicalRef: "S11",
      owner: "Operations",
    },
    {
      id: "publications",
      label: "Performance",
      canonicalRef: "S12–S13",
      owner: "Operations",
    },
    {
      id: "billing",
      label: "Finance",
      canonicalRef: "S14–S16",
      owner: "Finance",
    },
  ] as const;

/** @deprecated Prefer CAMPAIGN_PROCESS_STAGES — retained for existing imports. */
export const CAMPAIGN_TAB_PROCESS_CLUSTER: Record<
  CampaignWorkspaceTabId,
  { stageIds: string; label: string }
> = {
  overview: { stageIds: "S00–S01", label: "Overview" },
  lines: { stageIds: "S06", label: "Assignments" },
  "client-io": { stageIds: "S07–S08", label: "Client IO" },
  "vendor-io": { stageIds: "S09–S10", label: "Vendor IO" },
  deliverables: { stageIds: "S11", label: "Deliverables" },
  publications: { stageIds: "S12–S13", label: "Performance" },
  workflow: { stageIds: "cross-cutting", label: "Workflow" },
  billing: { stageIds: "S14–S16", label: "Finance" },
  timeline: { stageIds: "cross-cutting", label: "Timeline" },
};

export type CampaignProcessNavState = BusinessProcessLifecycleSignal;

export type CampaignProcessCue = BusinessProcessProgress<CampaignWorkspaceTabId> & {
  /** Compatibility aliases used by earlier Phase 1 wiring. */
  stageId: string;
  stageLabel: string;
  railTab: CampaignWorkspaceTabId;
  health: "healthy" | "waiting" | "attention" | "blocked";
  healthLabel: string;
  nextAction: string;
  nextActionTab: CampaignWorkspaceTabId;
};

export type CampaignProcessSignals = {
  status: CampaignStatus;
  lineCount: number;
  hasClientIo: boolean;
  clientIoStatus: string | null;
  vendorIoCount: number;
  approvedVendorIoCount: number;
  sentVendorIoCount: number;
  deliverableCount: number;
  overdueDeliverableCount: number;
  activePerformance: boolean;
  invoiceCount: number;
  billingOutstanding: number;
  blockerCount: number;
  poExceeded: boolean;
};

export function signalsFromCampaignListItem(campaign: CampaignListItem): CampaignProcessSignals {
  const budget = Number(campaign.po_amount_campaign_currency ?? 0);
  const consumed = Number(campaign.po_consumed_amount ?? 0);
  return {
    status: campaign.status,
    lineCount: campaign.lines?.length ?? 0,
    hasClientIo: false,
    clientIoStatus: null,
    vendorIoCount: 0,
    approvedVendorIoCount: 0,
    sentVendorIoCount: 0,
    deliverableCount: 0,
    overdueDeliverableCount: 0,
    activePerformance: campaign.status === "active",
    invoiceCount: 0,
    billingOutstanding: 0,
    blockerCount: 0,
    poExceeded: budget > 0 && consumed > budget,
  };
}

export function signalsFromCampaignWorkspace(workspace: CampaignWorkspace): CampaignProcessSignals {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueDeliverableCount = (workspace.deliverables ?? []).filter((row) => {
    if (!row.due_date) return false;
    if (row.display_status === "approved" || row.display_status === "posted") return false;
    const due = new Date(`${row.due_date}T00:00:00`);
    return due < today;
  }).length;

  const postedOrApproved = (workspace.deliverables ?? []).filter(
    (row) => row.display_status === "posted" || row.display_status === "approved"
  ).length;

  return {
    status: workspace.status,
    lineCount: workspace.lines.length,
    hasClientIo: Boolean(workspace.client_io),
    clientIoStatus: workspace.client_io?.status ?? null,
    vendorIoCount: workspace.vendor_ios.length,
    approvedVendorIoCount: workspace.vendor_ios.filter((io) => io.status === "approved").length,
    sentVendorIoCount: workspace.vendor_ios.filter(
      (io) => io.status === "sent" || io.status === "generated"
    ).length,
    deliverableCount: workspace.deliverables?.length ?? 0,
    overdueDeliverableCount,
    activePerformance:
      workspace.status === "active" &&
      (postedOrApproved > 0 || (workspace.deliverables?.length ?? 0) > 0),
    invoiceCount: workspace.invoices?.length ?? 0,
    billingOutstanding: workspace.financials.billing_outstanding ?? 0,
    blockerCount: workspace.blockers?.length ?? 0,
    poExceeded: workspace.financials.po_exceeded,
  };
}

function stageById(id: CampaignWorkspaceTabId) {
  return CAMPAIGN_PROCESS_STAGES.find((stage) => stage.id === id) ?? CAMPAIGN_PROCESS_STAGES[0];
}

function healthFromSignal(
  signal: BusinessProcessLifecycleSignal
): Pick<CampaignProcessCue, "health" | "healthLabel"> {
  switch (signal) {
    case "blocked":
      return { health: "blocked", healthLabel: "Blocked" };
    case "attention_required":
      return { health: "attention", healthLabel: "Attention Required" };
    case "waiting_internal":
    case "waiting_client":
    case "waiting_vendor":
      return { health: "waiting", healthLabel: lifecycleSignalLabel(signal) };
    default:
      return { health: "healthy", healthLabel: "Healthy" };
  }
}

type ProgressDraft = {
  currentStageId: CampaignWorkspaceTabId;
  statusLabel: string;
  lifecycleSignal: BusinessProcessLifecycleSignal;
  nextActionLabel: string;
  waitingFor: BusinessProcessWaitingParty;
  nextStageId?: CampaignWorkspaceTabId | null;
  owner?: BusinessProcessOwner;
};

function toCue(draft: ProgressDraft): CampaignProcessCue {
  const current = stageById(draft.currentStageId);
  const next =
    draft.nextStageId === null
      ? null
      : draft.nextStageId
        ? stageById(draft.nextStageId)
        : nextStageAfter(CAMPAIGN_PROCESS_STAGES, draft.currentStageId);
  const health = healthFromSignal(draft.lifecycleSignal);
  const progress = withRailSignals(CAMPAIGN_PROCESS_STAGES, {
    currentStageId: current.id,
    currentStageLabel: current.label,
    owner: draft.owner ?? current.owner,
    statusLabel: draft.statusLabel,
    lifecycleSignal: draft.lifecycleSignal,
    nextStageId: next?.id ?? null,
    nextStageLabel: next?.label ?? null,
    nextActionLabel: draft.nextActionLabel,
    waitingFor: draft.waitingFor,
    healthLabel: health.healthLabel,
    entryStageId: current.id,
  });

  return {
    ...progress,
    stageId: current.canonicalRef ?? current.id,
    stageLabel: current.label,
    railTab: current.id,
    health: health.health,
    healthLabel: health.healthLabel,
    nextAction: draft.nextActionLabel,
    nextActionTab: current.id,
  };
}

/**
 * Business-rule recommended stage: where work is actually required.
 * First matching rule wins (not furthest-along ordering).
 */
export function deriveCampaignProcessCue(signals: CampaignProcessSignals): CampaignProcessCue {
  const clientStatus = signals.clientIoStatus;
  const waitingClient =
    clientStatus === "sent" || clientStatus === "under_client_review";
  const vendorOutstanding =
    signals.vendorIoCount === 0
      ? false
      : signals.approvedVendorIoCount < signals.vendorIoCount;

  if (signals.status === "cancelled") {
    return toCue({
      currentStageId: "overview",
      statusLabel: "Cancelled",
      lifecycleSignal: "blocked",
      nextActionLabel: "Review campaign status",
      waitingFor: "Operations",
      nextStageId: null,
    });
  }

  if (signals.status === "completed") {
    return toCue({
      currentStageId: "overview",
      statusLabel: "Campaign complete",
      lifecycleSignal: "completed",
      nextActionLabel: "Review close-out",
      waitingFor: "None",
      nextStageId: null,
      owner: "Executive",
    });
  }

  if (signals.blockerCount > 0 || signals.poExceeded) {
    const stageId: CampaignWorkspaceTabId =
      signals.lineCount === 0
        ? "lines"
        : waitingClient || clientStatus
          ? "client-io"
          : vendorOutstanding
            ? "vendor-io"
            : "overview";
    return toCue({
      currentStageId: stageId,
      statusLabel: signals.poExceeded ? "PO limit exceeded" : "Blocked by open issues",
      lifecycleSignal: "blocked",
      nextActionLabel: "Resolve blockers",
      waitingFor: "Operations",
    });
  }

  // 1) Assignments incomplete
  if (signals.lineCount === 0) {
    return toCue({
      currentStageId: "lines",
      statusLabel: "In Progress",
      lifecycleSignal: "waiting_internal",
      nextActionLabel: "Complete assignments",
      waitingFor: "Operations",
      nextStageId: "client-io",
    });
  }

  // 2) Client IO waiting for approval
  if (waitingClient) {
    return toCue({
      currentStageId: "client-io",
      statusLabel: "Waiting for Client Approval",
      lifecycleSignal: "waiting_client",
      nextActionLabel: "Review Client IO",
      waitingFor: "Client",
      nextStageId: "vendor-io",
      owner: "Commercial",
    });
  }

  if (clientStatus === "rejected") {
    return toCue({
      currentStageId: "client-io",
      statusLabel: "Client IO rejected",
      lifecycleSignal: "blocked",
      nextActionLabel: "Resolve Client IO rejection",
      waitingFor: "Commercial",
      nextStageId: "vendor-io",
      owner: "Commercial",
    });
  }

  // Client IO needed / in prep after assignments
  if (!signals.hasClientIo || !clientStatus || clientStatus === "draft" || clientStatus === "generated") {
    return toCue({
      currentStageId: "client-io",
      statusLabel: clientStatus === "generated" ? "Ready to send" : "In Progress",
      lifecycleSignal: "waiting_internal",
      nextActionLabel:
        clientStatus === "generated" ? "Send Client IO" : "Prepare Client IO",
      waitingFor: "Commercial",
      nextStageId: "vendor-io",
      owner: "Commercial",
    });
  }

  // 3) Vendor IO outstanding (after client approval)
  if (clientStatus === "approved") {
    if (signals.vendorIoCount === 0) {
      return toCue({
        currentStageId: "vendor-io",
        statusLabel: "In Progress",
        lifecycleSignal: "waiting_internal",
        nextActionLabel: "Issue Vendor IO",
        waitingFor: "Operations",
        nextStageId: "deliverables",
      });
    }
    if (vendorOutstanding) {
      const waitingVendor = signals.sentVendorIoCount > 0 || signals.vendorIoCount > 0;
      return toCue({
        currentStageId: "vendor-io",
        statusLabel: waitingVendor
          ? "Waiting for Vendor Approval"
          : "In Progress",
        lifecycleSignal: waitingVendor ? "waiting_vendor" : "waiting_internal",
        nextActionLabel: waitingVendor
          ? "Follow up Vendor IO"
          : "Issue Vendor IO",
        waitingFor: waitingVendor ? "Vendor" : "Operations",
        nextStageId: "deliverables",
      });
    }
  }

  // 4) Deliverables overdue
  if (signals.overdueDeliverableCount > 0) {
    return toCue({
      currentStageId: "deliverables",
      statusLabel: "Deliverables overdue",
      lifecycleSignal: "attention_required",
      nextActionLabel: "Resolve overdue deliverables",
      waitingFor: "Operations",
      nextStageId: "publications",
    });
  }

  // Deliverables in flight before performance
  if (
    signals.deliverableCount > 0 &&
    !signals.activePerformance &&
    signals.billingOutstanding <= 0
  ) {
    return toCue({
      currentStageId: "deliverables",
      statusLabel: "In Progress",
      lifecycleSignal: "waiting_internal",
      nextActionLabel: "Track deliverables",
      waitingFor: "Operations",
      nextStageId: "publications",
    });
  }

  // 5) Performance active
  if (signals.activePerformance && signals.billingOutstanding <= 0 && signals.invoiceCount === 0) {
    return toCue({
      currentStageId: "publications",
      statusLabel: "In Progress",
      lifecycleSignal: "current",
      nextActionLabel: "Monitor performance",
      waitingFor: "Operations",
      nextStageId: "billing",
    });
  }

  // 6) Finance waiting / active
  if (signals.billingOutstanding > 0) {
    return toCue({
      currentStageId: "billing",
      statusLabel: "Waiting for collection",
      lifecycleSignal: "waiting_internal",
      nextActionLabel: "Follow up finance",
      waitingFor: "Finance",
      nextStageId: null,
      owner: "Finance",
    });
  }

  if (signals.invoiceCount > 0) {
    return toCue({
      currentStageId: "billing",
      statusLabel: "In Progress",
      lifecycleSignal: "current",
      nextActionLabel: "Review finance",
      waitingFor: "Finance",
      nextStageId: null,
      owner: "Finance",
    });
  }

  // Commercial path complete → deliverables entry
  if (clientStatus === "approved" && !vendorOutstanding) {
    return toCue({
      currentStageId: "deliverables",
      statusLabel: "In Progress",
      lifecycleSignal: "waiting_internal",
      nextActionLabel: "Manage deliverables",
      waitingFor: "Operations",
      nextStageId: "publications",
    });
  }

  return toCue({
    currentStageId: "lines",
    statusLabel: "In Progress",
    lifecycleSignal: "current",
    nextActionLabel: "Continue assignments",
    waitingFor: "Operations",
    nextStageId: "client-io",
  });
}

export function recommendCampaignProcessTab(
  signals: CampaignProcessSignals
): CampaignWorkspaceTabId {
  return deriveCampaignProcessCue(signals).entryStageId;
}

/** Rail signal for a stage — educational only; never disables navigation. */
export function processNavStateForTab(
  tabId: CampaignWorkspaceTabId,
  cue: CampaignProcessCue,
  _signals?: CampaignProcessSignals
): CampaignProcessNavState {
  if (tabId === "workflow" || tabId === "timeline") {
    return tabId === cue.entryStageId ? "current" : "upcoming";
  }
  return cue.stageSignals[tabId] ?? "upcoming";
}

export function campaignProcessCueFromListItem(campaign: CampaignListItem): CampaignProcessCue {
  return deriveCampaignProcessCue(signalsFromCampaignListItem(campaign));
}

export function campaignProcessCueFromWorkspace(workspace: CampaignWorkspace): CampaignProcessCue {
  return deriveCampaignProcessCue(signalsFromCampaignWorkspace(workspace));
}
