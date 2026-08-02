/**
 * Planning Context (product name: Planning Session)
 * =================================================
 *
 * INTERNAL RUNTIME ORCHESTRATION LAYER — NOT A BUSINESS OBJECT.
 *
 * Permanent governance: `.cursor/rules/thinkway-strategy-engine-governance.mdc`
 * Violation requires Architecture Reopen.
 *
 * MUST NEVER:
 * - become a database table
 * - become a CRM business object
 * - become a Studio document
 * - become a saved entity
 * - own business state
 * - duplicate business artifacts
 *
 * MAY ONLY:
 * - orchestrate capabilities
 * - maintain runtime state
 * - coordinate planning entry points
 * - coordinate capability interactions
 * - project Planning Views (ephemeral)
 * - apply validated changes back to canonical Platform objects
 *
 * All persistent business data remains on existing Platform objects
 * (Campaign Object, Media Plan via lib/media-plan, Outputs registry, optional CRM Campaign).
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { PlanningEntryPoint } from "./planning-entry";

/**
 * Lightweight runtime orchestration handle.
 * Strategy Engine capabilities receive this and read/write only through
 * accessors / apply helpers that mutate canonical Platform objects.
 */
export type PlanningContext = {
  /**
   * Ephemeral runtime id for in-memory correlation only.
   * Not a database primary key. Not a business document number.
   */
  contextId: string;
  /** How planning was opened — never forces workflow order. */
  entryPoint: PlanningEntryPoint;
  /**
   * Sole Studio planning persistence SSOT among context fields.
   * Brief, objectives, audience, budget, slate, strategy, presentation,
   * outputs registry, and Media Plan pointers live here (or engines on it).
   */
  campaignObject: CampaignObject;
  /** Optional CRM Campaign Header id — pointer only, never a copied campaign. */
  campaignHeaderId?: string | null;
};

/** Product-facing alias — same type as PlanningContext. Not a second entity. */
export type PlanningSession = PlanningContext;

export type PlanningStatus =
  | "empty"
  | "draft"
  | "in_progress"
  | "ready_for_review"
  | "in_review"
  | "approved"
  | "frozen"
  | "materialized";

/**
 * Read-only derived view for UI/tests/capability inspection.
 * Explicitly NOT owned state — recomputed from Campaign Object every time.
 * Must never be persisted as its own document.
 */
export type PlanningDerivedView = {
  contextId: string;
  entryPoint: PlanningEntryPoint;
  campaignObjectId: string;
  conversationId?: string;
  campaignHeaderId?: string | null;
  planningStatus: PlanningStatus;
  /** Derived from campaignFacts / sections — not stored on context. */
  brief: string | null;
  objectives: string | null;
  audience: string | null;
  markets: string[];
  platforms: string[];
  budget: { amount?: number; currency?: string } | null;
  kpis: string[];
  mediaMix: Array<{ tier: string; percent?: number; count?: number }>;
  creatorIds: string[];
  strategyNarrative: string | null;
  presentation: string | null;
  /** Media Plan attachment flags — schedule ledger remains on Campaign Object.meta. */
  mediaPlan: {
    attached: boolean;
    hasSchedule: boolean;
    hasLifecycle: boolean;
    campaignObjectId: string;
  };
  /** Outputs registry present on Campaign Object.meta — not copied. */
  hasOutputsRegistry: boolean;
};
