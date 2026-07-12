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
   * Campaign Deliverables registry — generation state + dependency fingerprints
   * for each client-facing deliverable. Deliverables are generated *views* over
   * this Campaign Object; this map never holds authoritative campaign data.
   * Optional for backward compatibility with campaigns created before the engine.
   */
  deliverables?: import("@/features/campaign-studio/services/deliverables/deliverable-types").DeliverableRegistryState;
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
