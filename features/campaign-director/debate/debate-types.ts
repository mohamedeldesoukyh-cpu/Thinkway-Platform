/** IS-3 Director Decision Debate Engine — pipeline metadata types only. */

import type { CampaignStrategyDocument } from "../types";

export type OptionArchetype = "max_reach" | "balanced" | "max_engagement";

export type OptionId = "A" | "B" | "C";

export type ActivationApproach = "burst" | "even" | "ramp";

export type PostingIntensity = "high" | "moderate" | "sustained";

export type RiskProfile = "high" | "moderate" | "low";

export type ActivationPlan = {
  approach: ActivationApproach;
  /** Percentage of creator roster activated each week (sums to 100). */
  weekWeights: number[];
  postingIntensity: PostingIntensity;
  postsPerWeek: number;
  overlapStrategy: string;
};

export type CampaignOption = {
  id: OptionId;
  label: string;
  archetype: OptionArchetype;
  /** Distinct strategic narrative for this option. */
  strategySlice: string;
  creatorTierStrategy: CampaignStrategyDocument["creatorTierStrategy"];
  timeline: {
    durationWeeks: number;
    rationale: string;
    activationOrder: string;
    activationPlan: ActivationPlan;
  };
  budget: {
    creatorFeePercent: number;
    contingencyPercent: number;
    rationale: string;
  };
  kpis: Array<{ metric: string; target: string; why: string }>;
  kpiPriorities: string[];
  objectiveEmphasis: string;
  postingCadence: string;
  riskProfile: RiskProfile;
  audienceStrategy: string;
  risks: string[];
};

export type DirectorRole =
  | "Strategy Director"
  | "Media Director"
  | "Creator Director"
  | "Finance Director"
  | "Risk Director"
  | "Performance Director"
  | "Presentation Director";

export type DirectorReview = {
  directorRole: DirectorRole;
  optionId: OptionId;
  strength: string;
  weakness: string;
  commercialRisk: string;
  wouldApprove: boolean;
  score: number;
  explanation: string;
};

export type DebateScore = {
  optionId: OptionId;
  rawTotal: number;
  weightedScore: number;
  averageScore: number;
  approvalCount: number;
  directorScores: Array<{ role: DirectorRole; score: number; wouldApprove: boolean }>;
};

export type DirectorMeetingDecision = {
  winnerId: OptionId;
  winnerLabel: string;
  approved: boolean;
  rejectionReasons: Array<{ optionId: OptionId; reasons: string[] }>;
  directorConclusion: string;
  meetingSummary: string;
};

export type DebateResult = {
  options: CampaignOption[];
  reviews: DirectorReview[];
  scores: DebateScore[];
  meeting: DirectorMeetingDecision;
  materialDifferenceValidated: boolean;
  ranAt: string;
};

export type DebateMetadata = {
  debateResult: DebateResult;
  rejectedOptionIds: OptionId[];
  winnerOptionId: OptionId;
};
