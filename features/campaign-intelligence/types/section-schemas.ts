/** Structured campaign section payloads — stored on CampaignObject.sections[*].content and .data */

export type BudgetAllocationLine = {
  category: string;
  amount?: number;
  percent?: number;
  notes?: string;
};

export type BudgetSectionData = {
  currency: string;
  total?: number;
  allocations: BudgetAllocationLine[];
  contingencyPercent?: number;
  notes?: string;
};

export type TimelineMilestone = {
  week: number;
  phase: string;
  activities: string[];
  status?: "pending" | "in_progress" | "complete";
};

export type TimelineSectionData = {
  durationWeeks?: number;
  milestones: TimelineMilestone[];
  goLiveWeek?: number;
};

export type KpiTarget = {
  metric: string;
  target: string;
  benchmark?: string;
  platform?: string;
};

export type KpiForecastSectionData = {
  kpis: KpiTarget[];
  forecastNotes?: string;
};

export type RiskItem = {
  risk: string;
  severity: "low" | "medium" | "high";
  mitigation?: string;
  category?: string;
};

export type RiskAnalysisSectionData = {
  risks: RiskItem[];
  overallRiskLevel?: "low" | "medium" | "high";
};

export type PresentationStatusSectionData = {
  status: "draft" | "ready" | "awaiting_approval" | "approved";
  campaignName?: string;
  brandName?: string;
  lineCount?: number;
  message: string;
  nextStep?: string;
};

/** Creator references only — no duplicated profile data on CampaignObject. */
export type CreatorDiscoverySectionData = {
  creatorIds: string[];
  total: number;
  query?: string;
};

export type VendorSelectedReasoning = {
  creatorId: string;
  displayName?: string;
  whySelected: string;
  whyNotAnother?: string;
  contribution?: string;
  expectedRole: string;
  audienceMatch: string;
  risk: string;
  alternative: string;
  confidence: number;
  evidence: string;
  tradeoff: string;
  missingData?: string[];
  manualVerification?: string;
  directorNotes?: string;
};

export type VendorRejectedReasoning = {
  creatorId: string;
  displayName?: string;
  whyRejected: string;
  evidence: string;
};

export type CreatorRecommendationSectionData = {
  creatorIds: string[];
  rationale?: string;
  avgFitScore?: number;
  /** Persisted CIP relevance scores keyed by creator id (survives DNA hydration). */
  creatorFitScores?: Record<string, number>;
  selectedReasoning?: VendorSelectedReasoning[];
  rejectedReasoning?: VendorRejectedReasoning[];
};

/** A creator referenced by a staged draft change (add / replace targets). */
export type StudioDraftCreatorRef = {
  creatorId: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  followers?: number;
  avatarUrl?: string;
  /** Where the creator came from — controls enrichment behavior. */
  source: "discovery" | "external_url";
  /** External-URL creators auto-enrich; discovery creators wait for manual refresh. */
  enrichmentStatus?: "not_requested" | "pending" | "enriched" | "failed";
};

/** One staged Studio edit — nothing recalculates until Apply All Updates. */
export type StudioDraftChange =
  | { kind: "remove_creator"; creatorId: string; displayName?: string; stagedAt: string }
  | {
      kind: "replace_creator";
      creatorId: string;
      displayName?: string;
      replacement: StudioDraftCreatorRef;
      stagedAt: string;
    }
  | { kind: "add_creator"; creator: StudioDraftCreatorRef; stagedAt: string }
  | { kind: "refresh_intelligence"; creatorId: string; displayName?: string; stagedAt: string };

/** Draft state for Studio edits — persisted with the campaign object, applied in one bulk operation. */
export type StudioDraftState = {
  changes: StudioDraftChange[];
  updatedAt: string;
};

export type CreatorsSectionData = {
  phase?: "discovery" | "shortlist" | "complete";
  discovery?: CreatorDiscoverySectionData;
  discoveryDisplay?: string;
  recommendations?: CreatorRecommendationSectionData;
  recommendationsDisplay?: string;
  discoveryPipeline?: DiscoveryPipelineStage[];
  vendorDiscoveryFunnel?: DiscoveryPipelineStage[];
  /** Studio debug — cip vs keyword discovery path. */
  discoveryEngine?: "cip" | "keyword";
  cipProfileId?: string;
  fitScoreCount?: number;
  lastDiscoveryAt?: string;
  lastShortlistAt?: string;
  /** Per-creator approve / reject / shortlist decisions from Studio UI. */
  vendorDecisions?: Record<string, "approved" | "rejected" | "shortlisted">;
  /** Discovery shortlist linked when user shortlists recommendations. */
  linkedShortlistId?: string;
  /** Legacy Studio grounding payload stripped on creator re-runs. */
  vendorGrounding?: GroundedVendor[];
  /** Pending Studio edits — draft until the user applies all updates. */
  studioDraft?: StudioDraftState;
};

export type ExecutiveStrategyReasoning = {
  businessChallenge: string;
  marketingChallenge: string;
  audienceChallenge: string;
  strategicInsight: string;
  rejectedAlternatives: string[];
  chosenStrategy: string;
  whyThisStrategyWins: string;
  expectedTradeoffs: string[];
  risks: string[];
  successConditions: string[];
  confidenceLevel: number;
  directorConclusion: string;
  evidence: string[];
};

export type BudgetAllocationReasoning = {
  category: string;
  amount?: number;
  percent?: number;
  reason: string;
  evidence: string;
  tradeoff: string;
  confidence: number;
  alternativeConsidered: string;
};

export type CreatorActivationWeek = {
  week: number;
  tier: string;
  objective: string;
  reason: string;
  evidence: string;
  tradeoff: string;
  confidence: number;
};

export type CreatorActivationTimeline = {
  activationWeeks: CreatorActivationWeek[];
  reportingPhase: { label: string; reason: string; evidence: string };
  durationWeeks: number;
};

export type CreatorMixReasoningTier = {
  tier: string;
  percent: number;
  whyThisTier: string;
  ifTierChanged: string;
  budgetImpact?: string;
  reachImpact?: string;
  erImpact?: string;
  rejectedAlternative?: string;
  evidence: string;
  tradeoff: string;
  confidence: number;
  alternativeConsidered: string;
};

export type CreatorMixSummary = {
  whyMix: string;
};

export type KpiReasoningEntry = {
  metric: string;
  target: string;
  reason: string;
  confidence: number;
  dependencies: string[];
  risk: string;
  tradeoff: string;
  sensitivity?: string;
  evidence: string;
  alternativeConsidered: string;
};

export type DirectorDecisionMinute = {
  problem: string;
  alternatives: string[];
  decision: string;
  rejected: string[];
  impact: string;
  owner: string;
  confidence: number;
  evidence: string;
  /** @deprecated IS-1 compat */
  reason?: string;
  alternativesConsidered?: string[];
  tradeoffs?: string[];
  risk?: string;
  finalApproval?: string;
};

export type DiscoveryPipelineStage = {
  id: string;
  label: string;
  count: number;
  status: "complete" | "active" | "pending";
  removedCount?: number;
  removalWhy?: string;
};

export type GroundingSource =
  | "AI"
  | "Historical"
  | "Industry"
  | "Client"
  | "Creator";

export type GroundedElement = {
  source: GroundingSource;
  confidence: number;
  reason: string;
  evidence?: string;
};

export type GroundedStrategyField = {
  label: string;
  value: string;
  grounding: GroundedElement;
};

export type GroundedBudgetAllocation = {
  category: string;
  percent: number;
  amount?: number;
  reason: string;
  source: GroundingSource;
  confidence: number;
};

export type GroundedKpi = {
  metric: string;
  prediction: string;
  confidence: number;
  reason: string;
  calculationSource: string;
  platform?: string;
  benchmark?: string;
};

export type VendorRankingFactor = {
  factor: string;
  score: number;
  reason: string;
};

export type GroundedVendor = {
  creatorId?: string;
  rank?: number;
  whySelected: string;
  factors: VendorRankingFactor[];
  grounding: GroundedElement;
};

export type IndustryBenchmarkComparison = {
  metric: string;
  expected: string;
  industry: string;
  variance: string;
  source: GroundingSource;
};

export type IndustryCompetitiveIntelligence = {
  marketLandscape?: string;
  creatorPricing?: string;
  engagementRanges?: string;
  seasonalConsiderations?: string;
  competitiveActivity?: string;
  successFactors?: string[];
  keyRisks?: string[];
};

export type IndustryBenchmarkData = {
  industry?: string;
  comparisons: IndustryBenchmarkComparison[];
  summary?: string;
  estCpm: string;
  estCpc: string;
  estReach: string;
  postingFrequency: string;
  creatorMixBenchmark: string;
  budgetEfficiency: string;
  competitiveIntelligence?: IndustryCompetitiveIntelligence;
};

export type ObjectiveAchievementEntry = {
  objective: string;
  confidence: number;
  supportingEvidence: string;
  risks: string[];
  recommendations: string[];
};

export type SuccessProbabilityData = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  improvements: string[];
  grounding: GroundedElement;
  objectiveAssessments?: ObjectiveAchievementEntry[];
};

export type OpportunityItem = {
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  source: GroundingSource;
};

export type ExecutiveSummaryData = {
  summary: string;
  keyDecisions: string[];
  recommendedActions: string[];
  immediateNextSteps: string[];
  expectedBusinessOutcome: string;
  grounding: GroundedElement;
};

export type CreativeConcept = {
  name: string;
  bigIdea: string;
  hook: string;
  keyVisual: string;
  contentTheme: string;
  cta: string;
  sampleCaption: string;
  hashtags: string[];
  targetEmotion?: string;
  contentStyle?: string;
  creatorStyle?: string;
  visualDirection?: string;
};

export type ContentPlanItem = {
  platform: string;
  contentType: string;
  creatorTier: string;
  quantity: number;
  postingDate: string;
  objective: string;
};

export type CreatorMixTier = {
  tier: "Nano" | "Micro" | "Mid" | "Macro" | "Celebrity";
  count: number;
  percent: number;
  reasoning: string;
};

export type WhyAiInsight = {
  category: string;
  title: string;
  rationale: string;
  evidence?: string;
  source?: GroundingSource;
  confidence?: number;
};

export type TimelineWeekDetail = {
  week: number;
  phase: string;
  activities: string[];
  deliverables: string[];
  owner: string;
  dependencies: string[];
  milestones: string[];
  approvalGates: string[];
  status: "pending" | "in_progress" | "complete";
};

export type SummarySectionData = {
  client?: string;
  brand?: string;
  product?: string;
  market?: string;
  targetAudience?: string;
  budget?: string;
  duration?: string;
  objective?: string;
  campaignType?: string;
  platforms?: string;
  creatorMix?: string;
  estimatedReach?: string;
  campaignStatus?: string;
  deliverables?: string;
};

export type StrategySectionData = {
  groundedFields?: GroundedStrategyField[];
  creativeConcepts?: CreativeConcept[];
  creatorMix?: CreatorMixTier[];
  creatorMixReasoning?: CreatorMixReasoningTier[];
  creatorMixSummary?: CreatorMixSummary;
  opportunities?: OpportunityItem[];
  whyAiInsights?: WhyAiInsight[];
  executiveStrategyReasoning?: ExecutiveStrategyReasoning;
  directorDecisionMinutes?: DirectorDecisionMinute[];
};

export type PerformanceSectionData = {
  groundedKpis?: GroundedKpi[];
  kpiReasoning?: KpiReasoningEntry[];
  successProbability?: SuccessProbabilityData;
  industryBenchmark?: IndustryBenchmarkData;
};

export type BudgetSectionExtras = {
  groundedAllocations?: GroundedBudgetAllocation[];
  allocationReasoning?: BudgetAllocationReasoning[];
  budgetPlannerReasoning?: string;
  cpmAssumption?: string;
  cpeAssumption?: string;
};

export type TimelineSectionExtras = {
  weekDetails?: TimelineWeekDetail[];
  contentPlan?: ContentPlanItem[];
  creatorActivationTimeline?: CreatorActivationTimeline;
};

export type PresentationSectionExtras = {
  executiveSummary?: ExecutiveSummaryData;
  completion?: {
    sectionsComplete: number;
    totalSections: number;
    completionPercent: number;
    version: string;
  };
};

export type OperationsSectionExtras = {
  enrichedRisks?: Array<{
    risk: string;
    severity: "low" | "medium" | "high";
    probability: "low" | "medium" | "high";
    impact: string;
    mitigation: string;
    owner: string;
    status: "Monitoring" | "Action required" | "Mitigated";
  }>;
};

export function isBudgetSectionData(value: unknown): value is BudgetSectionData {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.currency === "string" && Array.isArray(obj.allocations);
}

export function isTimelineSectionData(value: unknown): value is TimelineSectionData {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as TimelineSectionData).milestones);
}

export function isKpiForecastSectionData(value: unknown): value is KpiForecastSectionData {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as KpiForecastSectionData).kpis);
}

export function isRiskAnalysisSectionData(value: unknown): value is RiskAnalysisSectionData {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as RiskAnalysisSectionData).risks);
}

export function isPresentationStatusSectionData(
  value: unknown
): value is PresentationStatusSectionData {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.status === "string" && typeof obj.message === "string";
}

export function isSummarySectionData(value: unknown): value is SummarySectionData {
  return value != null && typeof value === "object";
}

export function isStrategySectionData(value: unknown): value is StrategySectionData {
  return value != null && typeof value === "object";
}

export function isPerformanceSectionData(value: unknown): value is PerformanceSectionData {
  return value != null && typeof value === "object";
}

export function isBudgetSectionExtras(value: unknown): value is BudgetSectionExtras {
  return value != null && typeof value === "object";
}

export function isTimelineSectionExtras(value: unknown): value is TimelineSectionExtras {
  return value != null && typeof value === "object";
}

export function isPresentationSectionExtras(value: unknown): value is PresentationSectionExtras {
  return value != null && typeof value === "object";
}

/** Studio section → owning CampaignObject section key. */
export const STUDIO_SECTION_OWNERS = {
  "campaign-summary": "summary",
  "executive-strategy": "strategy",
  "creator-discovery": "creators",
  "creator-recommendations": "creators",
  "budget-planner": "budget",
  timeline: "timeline",
  "kpi-forecast": "performance",
  "risk-analysis": "operations",
  "creative-concepts": "strategy",
  "content-plan": "timeline",
  "creator-mix": "strategy",
  "why-ai": "strategy",
  "industry-benchmark": "performance",
  "success-probability": "performance",
  "opportunity-finder": "strategy",
  "executive-summary": "presentation",
  "presentation-status": "presentation",
} as const;

export type StudioSectionId = keyof typeof STUDIO_SECTION_OWNERS;
