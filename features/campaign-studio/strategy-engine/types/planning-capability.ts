import type { PlanningStatus } from "./planning-context";

/**
 * Logical slices capabilities declare interest in.
 * These are routing labels — not owned fields on Planning Context.
 * Reads/writes resolve through Campaign Object accessors.
 */
export type PlanningSessionSlice =
  | "campaign"
  | "brief"
  | "objectives"
  | "audience"
  | "markets"
  | "platforms"
  | "budget"
  | "kpis"
  | "mediaMix"
  | "creatorSlate"
  | "creatorRoles"
  | "scenario"
  | "proposal"
  | "presentation"
  | "planningNotes"
  | "strategyNarrative"
  | "planningStatus"
  | "mediaPlan"
  | "outputs";

export type PlanningCapabilityId =
  | "campaign_brief"
  | "media_plan"
  | "budget"
  | "discovery"
  | "creator_compare"
  | "creator_slate"
  | "proposal"
  | "presentation"
  | "outputs"
  | "objectives"
  | "audience"
  | "strategy_narrative"
  | "approval";

export type PlanningCapabilityDefinition = {
  id: PlanningCapabilityId;
  label: string;
  description: string;
  reads: readonly PlanningSessionSlice[];
  writes: readonly PlanningSessionSlice[];
};

/**
 * Patch intents applied to Campaign Object via Strategy Engine.
 * Never persisted on Planning Context itself.
 */
export type PlanningCapabilityPatch = {
  brief?: string | null;
  objectives?: string | null;
  audience?: string | null;
  markets?: string[];
  platforms?: string[];
  budget?: { amount?: number; currency?: string } | null;
  kpis?: string[];
  strategyNarrative?: string | null;
  presentation?: string | null;
  proposal?: string | null;
  brandName?: string | null;
  clientName?: string | null;
  /** Status intent — mapped onto Campaign Object workflow/lifecycle signals only when applicable. */
  planningStatus?: PlanningStatus;
  /** Creator ids to set on recommendations (writes creators section on Campaign Object). */
  creatorIds?: string[];
};
