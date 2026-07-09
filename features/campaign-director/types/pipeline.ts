/** Campaign Director intelligence pipeline types — SSOT strategy through approval. */

import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { DirectorReviewReport } from "./review-conversation";

export type DirectorSpecialistId =
  | "strategy"
  | "creative"
  | "creator_intelligence"
  | "media_planner"
  | "finance"
  | "risk"
  | "performance"
  | "presentation";

export type CampaignBriefInput = {
  rawMessage: string;
  brandName?: string;
  clientName?: string;
  inferredFields?: string[];
  /** Validated structured facts — SSOT for factual fields when present. */
  campaignFacts?: CampaignFacts;
};

export type CampaignStrategyDocument = {
  id: string;
  version: number;
  createdAt: string;
  /** Reference to structured facts used to build this strategy. */
  factsRef?: {
    extractedAt: string;
    fields: string[];
  };
  /** Parsed campaign brief — director understanding before specialist dispatch. */
  understanding: {
    client?: string;
    brand: string;
    industry?: string;
    objective: string;
    budget?: { amount?: number; currency: string; rationale: string };
    timeline?: { durationWeeks: number; rationale: string };
    geography?: string;
    audience: string;
    platforms: string[];
    kpis: Array<{ metric: string; target: string; why: string }>;
    risks: string[];
    constraints: string[];
  };
  /** Single strategic narrative — SSOT for all specialists. */
  narrative: string;
  /** Director-approved strategic pillars with rationale. */
  pillars: Array<{ title: string; what: string; why: string }>;
  /** Platform mix decisions. */
  platformMix: Array<{ platform: string; role: string; why: string }>;
  /** Creator tier strategy. */
  creatorTierStrategy: Array<{ tier: string; allocationPercent: number; why: string }>;
};

export type SpecialistOutput = {
  specialistId: DirectorSpecialistId;
  domain: string;
  what: string;
  why: string;
  evidence: string[];
  sections: string[];
  status: "draft" | "reviewed" | "revised" | "approved";
  revisionRound: number;
};

export type CrossReviewFinding = {
  id: string;
  reviewerId: DirectorSpecialistId;
  targetId: DirectorSpecialistId;
  issue: string;
  requiredRevision: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
};

export type DirectorConflictType =
  | "budget_total"
  | "budget_creator_mix"
  | "timeline_internal"
  | "timeline_duration"
  | "creator_budget"
  | "kpi_strategy"
  | "platform_mix"
  | "brand_objective"
  | "cross_section";

export type DirectorChallenge = {
  id: string;
  conflictType: DirectorConflictType;
  description: string;
  affectedSections: string[];
  assignedTo: DirectorSpecialistId;
  resolutionStatus: "open" | "revised" | "resolved";
  resolution?: string;
};

export type ApprovalGate = {
  approved: boolean;
  unresolvedConflictCount: number;
  crossReviewOpenCount: number;
  revisionRounds: number;
  approvedAt?: string;
  blockers: string[];
};

export type DirectorApprovedSection = {
  sectionKey: string;
  content: string | Record<string, unknown>;
  data?: Record<string, unknown>;
  rationale: string;
  approvedBy: DirectorSpecialistId;
};

export type DirectorPipelineResult = {
  strategyDocument: CampaignStrategyDocument;
  specialistOutputs: SpecialistOutput[];
  crossReviewFindings: CrossReviewFinding[];
  challenges: DirectorChallenge[];
  approvalGate: ApprovalGate;
  decisionIntelligenceGate?: import("../services/decision-intelligence-gate").DecisionIntelligenceGateResult;
  /** Release 1.1.7 governance pipeline — metadata only, not rendered in UI. */
  governance?: import("@/features/campaign-governance/governance-types").GovernancePipelineResult;
  approvedSections: DirectorApprovedSection[];
  /** Internal review conversation — not rendered in client UI. */
  reviewReport?: DirectorReviewReport;
  /** IS-3 debate result — metadata only, not rendered in client UI sections. */
  debateResult?: import("../debate/debate-types").DebateResult;
};

export type DirectorPipelineState = {
  phase:
    | "strategy"
    | "specialists"
    | "cross_review"
    | "challenge"
    | "revision"
    | "approval"
    | "complete";
  result?: DirectorPipelineResult;
};
