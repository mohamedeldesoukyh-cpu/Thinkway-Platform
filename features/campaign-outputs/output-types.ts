/**
 * Campaign Outputs Engine — type vocabulary.
 *
 * A Campaign Output is a *generated view over the Campaign Object* (the Single
 * Source of Truth) — never a separate object and never duplicated data.
 *
 * Naming note: this is deliberately "Campaign Output", not "deliverable". In
 * agency/influencer language a *deliverable* is a creator asset (Reel, Story,
 * Static Post, YouTube integration). A *Campaign Output* is an artifact the
 * platform generates about the whole campaign (Strategy, Media Plan, Proposal,
 * KPI Forecast, …). The internal architecture uses "output" everywhere to avoid
 * that ambiguity; user-facing copy may still say "Generate Deliverables".
 *
 * The Campaign Outputs Engine is a platform capability, not a Studio feature:
 * the Studio *consumes* outputs; the Engine *generates* them; both read the same
 * Campaign Object.
 */

/** Every client-facing output the Engine can generate from a Campaign Object. */
export type CampaignOutputKind =
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
 * The campaign inputs an output derives from. These drive the dependency graph:
 * when an input changes, every output that depends on it becomes "Needs Update".
 * Input keys are stable slices of the Campaign Object, not sections — several
 * outputs can share one input.
 */
export type CampaignOutputInputKey =
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

export type CampaignOutputStatus = "not_generated" | "generated" | "needs_update";

/** A grouping used only for display ordering in the Campaign Outputs Center. */
export type CampaignOutputCategory =
  | "strategy"
  | "planning"
  | "performance"
  | "creative"
  | "presentation"
  | "operations";

/** One block of rendered output content — generic so any output renders/exports uniformly. */
export type CampaignOutputContentSection = {
  heading: string;
  body?: string;
  items?: string[];
  table?: { columns: string[]; rows: string[][] };
};

/**
 * The rendered, human-readable output. `data` carries the structured payload
 * (e.g. the Media Plan's week→day schedule) for richer rendering/export;
 * `sections` is always present so every output can be shown and exported the
 * same way.
 */
export type CampaignOutputContent = {
  title: string;
  summary?: string;
  sections: CampaignOutputContentSection[];
  data?: Record<string, unknown>;
};

/**
 * The persisted registry entry for one output. It is metadata + a snapshot of
 * the generated view — never authoritative campaign data, only a derived
 * rendering plus the fingerprint of the inputs it came from and the version of
 * the generator that produced it.
 */
export type CampaignOutputRecord = {
  kind: CampaignOutputKind;
  status: CampaignOutputStatus;
  /** Output-local version, incremented on each (re)generation. */
  version: number;
  generatedAt?: string;
  updatedAt?: string;
  /** Campaign Object version this output was generated from, when known. */
  campaignVersion?: number;
  /** Fingerprint of the source inputs at generation time — drives staleness. */
  sourceFingerprint?: string;
  /** The generator's semantic version at generation time — for reproducibility/compare. */
  generatorVersion?: string;
  /** The generated view, cached for View/Export without recomputation. */
  content?: CampaignOutputContent;
};

/** The registry state stored on `CampaignObjectMeta.campaignOutputs`. */
export type CampaignOutputRegistryState = Partial<
  Record<CampaignOutputKind, CampaignOutputRecord>
>;
