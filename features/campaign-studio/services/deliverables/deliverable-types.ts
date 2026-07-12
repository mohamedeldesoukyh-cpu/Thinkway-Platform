/**
 * Campaign Deliverables Engine — type vocabulary.
 *
 * A deliverable is a *generated view over the Campaign Object* — never a
 * separate object and never duplicated data. Every deliverable derives from the
 * Campaign Object (the Single Source of Truth). The registry stores, per
 * deliverable, only: whether it has been generated, when, from which campaign
 * inputs, at what version, plus a fingerprint of those inputs so the dependency
 * graph can tell when it has gone stale ("Needs Update").
 */

/** Every client-facing deliverable Thinkway can generate from a Campaign Object. */
export type DeliverableKind =
  | "full_strategy"
  | "executive_proposal"
  | "media_plan"
  | "content_calendar"
  | "posting_timeline"
  | "creator_activation"
  | "campaign_playbook"
  | "kpi_forecast"
  | "risk_plan"
  | "budget_allocation"
  | "amplification_plan"
  | "executive_summary"
  | "creative_concepts"
  | "client_presentation"
  | "statement_of_work"
  | "campaign_brief"
  | "internal_operations";

/**
 * The campaign inputs a deliverable derives from. These drive the dependency
 * graph: when an input changes, every deliverable that depends on it becomes
 * "Needs Update". Input keys are stable slices of the Campaign Object, not
 * sections — several deliverables can share one input.
 */
export type DeliverableInputKey =
  | "objective"
  | "audience"
  | "market"
  | "platforms"
  | "creators"
  | "budget"
  | "timeline"
  | "kpis"
  | "strategy"
  | "creative_concepts"
  | "risks"
  | "deliverables_scope";

export type DeliverableStatus = "not_generated" | "generated" | "needs_update";

/** A grouping used only for display ordering in the Deliverables panel. */
export type DeliverableCategory =
  | "strategy"
  | "planning"
  | "performance"
  | "creative"
  | "presentation"
  | "operations";

/** One block of rendered deliverable content — generic so any deliverable renders/exports uniformly. */
export type DeliverableContentSection = {
  heading: string;
  /** Free-text paragraph(s). */
  body?: string;
  /** Bulleted items. */
  items?: string[];
  /** Optional simple table (header row + rows). */
  table?: { columns: string[]; rows: string[][] };
};

/**
 * The rendered, human-readable deliverable. `data` carries the structured payload
 * (e.g. the Media Plan's week→day schedule) for richer rendering/export; `sections`
 * is always present so every deliverable can be shown and exported the same way.
 */
export type DeliverableContent = {
  title: string;
  summary?: string;
  sections: DeliverableContentSection[];
  data?: Record<string, unknown>;
};

/**
 * The persisted registry entry for one deliverable. It is metadata + a snapshot
 * of the generated view — it never holds authoritative campaign data, only a
 * derived rendering plus the fingerprint of the inputs it came from.
 */
export type DeliverableRecord = {
  kind: DeliverableKind;
  status: DeliverableStatus;
  /** Deliverable-local version, incremented on each (re)generation. */
  version: number;
  generatedAt?: string;
  updatedAt?: string;
  /** Campaign Object version this deliverable was generated from, when known. */
  campaignVersion?: number;
  /** Fingerprint of the source inputs at generation time — drives staleness. */
  sourceFingerprint?: string;
  /** The generated view, cached for View/Export without recomputation. */
  content?: DeliverableContent;
};

/** The registry state stored on `CampaignObjectMeta.deliverables`. */
export type DeliverableRegistryState = Partial<Record<DeliverableKind, DeliverableRecord>>;
