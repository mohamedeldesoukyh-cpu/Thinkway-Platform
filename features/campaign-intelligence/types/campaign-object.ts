export type CampaignSpecialistId = "strategist" | "scout" | "planner" | "analyst";

export type CampaignSectionStatus = "pending" | "working" | "complete";

export type CampaignObjectStatus = "draft" | "building" | "paused" | "complete";

export type CampaignSectionKey =
  | "summary"
  | "audience"
  | "strategy"
  | "creators"
  | "budget"
  | "timeline"
  | "performance"
  | "presentation"
  | "operations";

export type CampaignSection = {
  content: string | Record<string, unknown>;
  data?: Record<string, unknown>;
  updatedBy?: CampaignSpecialistId | "director";
  updatedAt?: string;
  status: CampaignSectionStatus;
};

export type CampaignObjectSections = {
  summary: CampaignSection;
  audience: CampaignSection;
  strategy: CampaignSection;
  creators: CampaignSection;
  budget: CampaignSection;
  timeline: CampaignSection;
  performance: CampaignSection;
  presentation: CampaignSection;
  operations: CampaignSection;
};

export type SpecialistProgress = {
  id: CampaignSpecialistId;
  label: string;
  status: "idle" | "working" | "complete";
  currentTask?: string;
};

export type CampaignDirectorPipelineMeta = {
  approved: boolean;
  strategyDocumentId?: string;
  unresolvedConflicts?: number;
  revisionRounds?: number;
  approvedAt?: string;
  /** Internal Director review conversation — not rendered in UI. */
  reviewReport?: import("@/features/campaign-director/types/review-conversation").DirectorReviewReport;
  /** IS-3 debate metadata — pipeline only, not rendered in UI sections. */
  debateResult?: import("@/features/campaign-director/debate/debate-types").DebateMetadata;
  /** Release 1.1.7 governance reports — metadata only. */
  governance?: import("@/features/campaign-governance/governance-types").CampaignGovernanceMeta;
  /** Governance self-repair audit — blockers, attempted repairs, user questions, outcome. */
  governanceRepair?: import("@/features/campaign-governance/governance-repair").GovernanceRepairSummary;
};

export type CampaignObjectMeta = {
  status: CampaignObjectStatus;
  specialistProgress: SpecialistProgress[];
  inferredFields?: string[];
  workflowStatus?: string;
  currentStep?: number;
  totalSteps?: number;
  progressPercent?: number;
  clarificationQuestion?: string;
  completedTasks?: string[];
  pendingTasks?: string[];
  /** Structured campaign facts SSOT — internal metadata, not rendered in UI. */
  campaignFacts?: import("@/features/campaign-director/facts/campaign-facts-types").CampaignFacts;
  directorPipeline?: CampaignDirectorPipelineMeta;
  /** IS-3 debate result — metadata only, rejected options never in sections. */
  directorDebate?: import("@/features/campaign-director/debate/debate-types").DebateMetadata;
  /** Release 1.1.7 enterprise governance — internal QA/compliance/presentation reports. */
  governance?: import("@/features/campaign-governance/governance-types").CampaignGovernanceMeta;
  /** Campaign Copilot change history — one entry per applied conversational edit. */
  copilotChangeLog?: CopilotChangeLogEntry[];
  /**
   * Campaign Outputs registry — generation state + dependency fingerprints for
   * each Campaign Output (Strategy, Media Plan, Proposal, …). Outputs are
   * generated *views* over this Campaign Object; this map never holds
   * authoritative campaign data. Optional for backward compatibility with
   * campaigns created before the Campaign Outputs Engine.
   */
  campaignOutputs?: import("@/features/campaign-outputs/output-types").CampaignOutputRegistryState;
  /**
   * Quotation commercial snapshot (ad types, avatars, fees) — written on quotation
   * sync and used by Media Plan even when Copilot overwrites creators.data.
   */
  quotationCommercials?: import("@/features/campaign-outputs/hydration/quotation-commercials-meta").QuotationCommercialsMeta;
  /** Media plan slot distribution — week weights and per-creator overrides (not start date). */
  mediaPlanSchedule?: import("@/features/campaign-outputs/media-plan-schedule").MediaPlanScheduleMeta;
  /** Approved influencer concepts + upload refs for Media Plan Creative Direction. */
  influencerConcepts?: import("@/features/campaign-outputs/influencer-concepts").InfluencerConceptsMeta;
  /** Media plan section visibility, standard/strategy mode, and export preferences. */
  mediaPlanPresentation?: import("@/features/campaign-outputs/media-plan-presentation").MediaPlanPresentationConfig;
  /** SSOT reference for the campaign brief asset — links across Studio, Outputs, and Media Plan. */
  campaignBriefRef?: import("@/features/campaign-outputs/campaign-brief-ref").CampaignBriefRef;
  /** Brief → Quotation → Campaign pipeline timestamps for conversion reporting (Phase 2 dashboard). */
  briefPipeline?: import("@/features/campaign-outputs/campaign-brief-ref").CampaignBriefPipelineMeta;
};

/** A single applied Campaign Copilot edit, for change history and the digest. */
export type CopilotChangeLogEntry = {
  /** Human-readable summary, e.g. "Removed all Celebrity creators". */
  summary: string;
  /** The structured intent kind that produced this change. */
  intent: string;
  /** The studio section this edit touched — drives "this section" resolution. */
  section?: string;
  /** Campaign object version created by this change, when persisted. */
  version?: number;
  /** Overall campaign score after the change, when available. */
  overallScoreAfter?: number;
  appliedAt: string;
};

export type CampaignObject = {
  id: string;
  conversationId?: string;
  workflowId?: string;
  updatedAt: string;
  sections: CampaignObjectSections;
  meta: CampaignObjectMeta;
};

export type SpecialistSectionUpdate = {
  sectionKey: CampaignSectionKey;
  content: string | Record<string, unknown>;
  data?: Record<string, unknown>;
  status?: CampaignSectionStatus;
};

export type CampaignObjectSnapshot = Pick<
  CampaignObject,
  "id" | "conversationId" | "workflowId" | "updatedAt" | "sections" | "meta"
>;
