/**
 * Reusable Business Process Navigation model (Architecture v1.0).
 * Domain adapters (e.g. campaign lifecycle) map onto these types.
 * Stage sets may later vary by campaign type — keep definitions data-driven.
 */

export type BusinessProcessLifecycleSignal =
  | "completed"
  | "current"
  | "upcoming"
  | "waiting_internal"
  | "waiting_client"
  | "waiting_vendor"
  | "blocked"
  | "attention_required";

export type BusinessProcessOwner =
  | "Operations"
  | "Commercial"
  | "Client"
  | "Vendor"
  | "Creator"
  | "Finance"
  | "Executive";

export type BusinessProcessWaitingParty =
  | "Operations"
  | "Commercial"
  | "Client"
  | "Vendor"
  | "Creator"
  | "Finance"
  | "None";

export type BusinessProcessStageDefinition<TStageId extends string = string> = {
  id: TStageId;
  label: string;
  /** Canonical architecture reference (e.g. S06). */
  canonicalRef?: string;
  owner: BusinessProcessOwner;
};

/**
 * Lightweight business context for the campaign's operational progress.
 * Answers: Where am I? What's done? What's next? What's blocking? Who owns? What's expected?
 */
export type BusinessProcessProgress<TStageId extends string = string> = {
  currentStageId: TStageId;
  currentStageLabel: string;
  owner: BusinessProcessOwner;
  /** Operator-facing status, e.g. "Waiting for Client Approval". */
  statusLabel: string;
  lifecycleSignal: BusinessProcessLifecycleSignal;
  nextStageId: TStageId | null;
  nextStageLabel: string | null;
  /** Concrete expected action, e.g. "Review Client IO". */
  nextActionLabel: string;
  waitingFor: BusinessProcessWaitingParty;
  /** Portfolio health wording. */
  healthLabel: string;
  /** Default deep-link entry — where work is required (never blocks other stages). */
  entryStageId: TStageId;
  /** Per-stage rail signals. Never used to disable navigation. */
  stageSignals: Partial<Record<TStageId, BusinessProcessLifecycleSignal>>;
};

export function lifecycleSignalLabel(signal: BusinessProcessLifecycleSignal): string {
  switch (signal) {
    case "completed":
      return "Completed";
    case "current":
      return "Current";
    case "upcoming":
      return "Upcoming";
    case "waiting_internal":
      return "Waiting for Internal Team";
    case "waiting_client":
      return "Waiting for Client";
    case "waiting_vendor":
      return "Waiting for Vendor";
    case "blocked":
      return "Blocked";
    case "attention_required":
      return "Attention Required";
    default:
      return signal;
  }
}
