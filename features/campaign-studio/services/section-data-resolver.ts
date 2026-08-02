import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  buildBudgetSectionData,
  buildRiskAnalysisFromBudget,
  detectCurrencyFromText,
} from "@/features/campaign-intelligence/services/structured-section-builders";
import {
  isBudgetSectionData,
  isBudgetSectionExtras,
  isKpiForecastSectionData,
  isPerformanceSectionData,
  isPresentationSectionExtras,
  isPresentationStatusSectionData,
  isRiskAnalysisSectionData,
  isStrategySectionData,
  isSummarySectionData,
  isTimelineSectionData,
  isTimelineSectionExtras,
  type BudgetSectionData,
  type BudgetSectionExtras,
  type CreatorsSectionData,
  type CreativeConcept,
  type CreatorMixTier,
  type ContentPlanItem,
  type GroundedKpi,
  type GroundedStrategyField,
  type GroundedVendor,
  type IndustryBenchmarkData,
  type KpiForecastSectionData,
  type OpportunityItem,
  type OperationsSectionExtras,
  type PresentationStatusSectionData,
  type RiskAnalysisSectionData,
  type SuccessProbabilityData,
  type SummarySectionData,
  type StrategySectionData,
  type TimelineSectionData,
  type TimelineWeekDetail,
  type WhyAiInsight,
  type ExecutiveSummaryData,
  type ExecutiveStrategyReasoning,
  type DirectorDecisionMinute,
  type CreatorActivationTimeline,
  type KpiReasoningEntry,
  type BudgetAllocationReasoning,
  type VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStudioSectionId } from "../types/campaign-studio";
import {
  deriveVendorRankingFactors,
  buildTimelineWeeksForCampaign,
  type VendorFactorInput,
} from "./presentation-intelligence";
import {
  detectIndustryFromBrief,
} from "./industry-intelligence";
import {
  normalizeBudgetAllocationPercents,
} from "./budget-allocation";
import {
  clampCampaignDurationWeeks,
  resolveCampaignDurationWeeks,
  resolveGoLiveWeek,
} from "./timeline-duration";
import { dedupeCreatorIds } from "@/lib/creators/dedupe-creators";
import {
  forecastToGroundedKpis,
  forecastSnapshotToGroundedKpis,
} from "@/lib/campaign-forecast";
import type { DiscoveryPipelineStage } from "@/features/campaign-intelligence/types/section-schemas";
import {
  localizeMoneyString,
  parseBrandFromText,
  resolveCampaignCurrency,
  sanitizeTimelineText,
  stripInternalSearchMetadata,
} from "../components/sections/shared/format-utils";
import {
  humanizeCreatorHandle,
  parseCompactFollowerCount,
  toBoardroomLanguage,
} from "./boardroom-language";
import {
  applyFactsToSummaryData,
  buildBudgetSectionDataFromFacts,
  buildCreatorMixFromFacts,
  dedupeCreatorMixTiers,
  buildGroundedKpisFromFacts,
  getCampaignFacts,
  getCampaignFactsOrLegacy,
  resolveFactsBrandName,
  resolveFactsClientName,
  resolveFactsCurrency,
  resolveInfluencerEstimateCurrency,
  resolveFactsDurationWeeks,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { parsePlatformFromRecommendationLine } from "./creator-platform-utils";
import { estimateCreatorPostFee } from "./creator-fee-estimator";

function readCreatorsData(campaignObject?: CampaignObject): CreatorsSectionData {
  return (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
}

function hasApprovedVendorFunnel(creatorsData: CreatorsSectionData): boolean {
  return (creatorsData.vendorDiscoveryFunnel?.length ?? 0) > 0;
}

function directorGrounding(
  confidence: number,
  reason: string
): import("@/features/campaign-intelligence/types/section-schemas").GroundedElement {
  return { source: "AI", confidence, reason };
}

/** Map IS-1 executive strategy reasoning to studio card fields. */
export function executiveStrategyReasoningToFields(
  reasoning: ExecutiveStrategyReasoning
): GroundedStrategyField[] {
  const grounding = directorGrounding(
    reasoning.confidenceLevel,
    reasoning.directorConclusion || reasoning.whyThisStrategyWins
  );

  const fields: Array<{ label: string; value: string | undefined }> = [
    { label: "Business Challenge", value: reasoning.businessChallenge },
    { label: "Marketing Challenge", value: reasoning.marketingChallenge },
    { label: "Audience Challenge", value: reasoning.audienceChallenge },
    { label: "Strategic Insight", value: reasoning.strategicInsight },
    { label: "Chosen Strategy", value: reasoning.chosenStrategy },
    { label: "Why This Strategy Wins", value: reasoning.whyThisStrategyWins },
    { label: "Director Conclusion", value: reasoning.directorConclusion },
  ];

  if (reasoning.rejectedAlternatives.length > 0) {
    fields.push({
      label: "Rejected Alternatives",
      value: reasoning.rejectedAlternatives.join("; "),
    });
  }
  if (reasoning.expectedTradeoffs.length > 0) {
    fields.push({
      label: "Expected Tradeoffs",
      value: reasoning.expectedTradeoffs.join("; "),
    });
  }
  if (reasoning.risks.length > 0) {
    fields.push({ label: "Strategic Risks", value: reasoning.risks.join("; ") });
  }
  if (reasoning.successConditions.length > 0) {
    fields.push({
      label: "Success Conditions",
      value: reasoning.successConditions.join("; "),
    });
  }

  return fields
    .filter((field) => field.value?.trim())
    .map((field) => ({
      label: field.label,
      value: field.value!.trim(),
      grounding,
    }));
}

/** Map IS-1 director decision minutes to Thinkway Decision Rationale cards. */
export function directorDecisionMinutesToInsights(
  minutes: DirectorDecisionMinute[]
): WhyAiInsight[] {
  return minutes.map((minute, index) => ({
    category: toBoardroomLanguage(minute.problem?.trim() || `Decision ${index + 1}`),
    title: toBoardroomLanguage(minute.decision),
    rationale: toBoardroomLanguage(
      minute.impact ||
        minute.reason ||
        minute.evidence ||
        minute.finalApproval ||
        ""
    ),
    evidence: minute.evidence ? toBoardroomLanguage(minute.evidence) : minute.evidence,
    confidence: minute.confidence,
    source: "AI" as const,
  }));
}

function kpiReasoningToGrounded(kpis: KpiReasoningEntry[]): GroundedKpi[] {
  return kpis.map((kpi) => ({
    metric: kpi.metric,
    prediction: kpi.target,
    confidence: kpi.confidence,
    reason: kpi.reason,
    calculationSource: "Director KPI reasoning",
    benchmark: kpi.sensitivity,
  }));
}

function allocationReasoningToGrounded(
  allocations: BudgetAllocationReasoning[]
): import("@/features/campaign-intelligence/types/section-schemas").GroundedBudgetAllocation[] {
  return allocations.map((line) => ({
    category: line.category,
    percent: line.percent ?? 0,
    amount: line.amount,
    reason: line.reason,
    source: "AI" as const,
    confidence: line.confidence,
  }));
}

function activationTimelineToWeeks(
  timeline: CreatorActivationTimeline,
  isComplete: boolean
): TimelineWeekDetail[] {
  const activationWeeks = timeline.activationWeeks.map((week, index) => {
    let status: TimelineWeekDetail["status"] = "pending";
    if (isComplete) {
      status = "complete";
    } else if (index === 0) {
      status = "in_progress";
    }

    return {
      week: week.week,
      phase: week.objective,
      activities: [week.reason].filter(Boolean),
      deliverables: [],
      milestones: [],
      owner: week.tier,
      dependencies: [],
      approvalGates: [],
      status,
    };
  });

  if (timeline.reportingPhase?.label) {
    activationWeeks.push({
      week: timeline.durationWeeks + 1,
      phase: timeline.reportingPhase.label,
      activities: [timeline.reportingPhase.reason].filter(Boolean),
      deliverables: [],
      milestones: [],
      owner: "Reporting",
      dependencies: [],
      approvalGates: [],
      status: isComplete ? "complete" : "pending",
    });
  }

  return activationWeeks;
}

function findSelectedReasoning(
  selectedReasoning: VendorSelectedReasoning[] | undefined,
  vendor: VendorFactorInput,
  index: number
): VendorSelectedReasoning | undefined {
  if (!selectedReasoning?.length) return undefined;

  return (
    selectedReasoning.find(
      (entry) =>
        entry.creatorId === vendor.handle ||
        (vendor.displayName &&
          entry.displayName?.toLowerCase() === vendor.displayName.toLowerCase())
    ) ?? selectedReasoning[index]
  );
}

/** Canonical creator counts — single source for discovery, recommendations, and presentation. */
export function resolveCreatorCounts(campaignObject: CampaignObject | undefined): {
  discoveryIds: string[];
  recommendationIds: string[];
  /** Profiles returned from search (searchTotal), when available. */
  profilesScreened: number | null;
  discoveryCount: number;
  recommendationCount: number;
  canonicalCount: number;
} {
  const creatorsData = readCreatorsData(campaignObject);
  const discoveryIds = dedupeCreatorIds(creatorsData.discovery?.creatorIds ?? []);
  const recommendationIds = dedupeCreatorIds(creatorsData.recommendations?.creatorIds ?? []);
  const discoveryTotal = creatorsData.discovery?.total;
  const profilesScreened =
    discoveryTotal != null && discoveryTotal > 0 ? discoveryTotal : null;
  const discoveryCount =
    profilesScreened ?? (discoveryIds.length > 0 ? discoveryIds.length : 0);
  const recommendationCount = recommendationIds.length;
  const canonicalCount = recommendationCount > 0 ? recommendationCount : discoveryCount;

  return {
    discoveryIds,
    recommendationIds,
    profilesScreened,
    discoveryCount,
    recommendationCount,
    canonicalCount,
  };
}

const DISCOVERY_PIPELINE_STAGE_DEFS = [
  { id: "db", label: "Thinkway Database" },
  { id: "screened", label: "Profiles Screened" },
  { id: "matched", label: "Matched" },
  { id: "ai", label: "AI Qualified" },
  { id: "ranked", label: "Ranked" },
  { id: "recommended", label: "Recommended" },
] as const;

function isContradictoryPipeline(
  pipeline: DiscoveryPipelineStage[],
  profilesScreened: number | null,
  finalCount: number
): boolean {
  if (pipeline.length === 0) return true;
  const screened = pipeline.find((s) => s.id === "screened" || s.id === "db")?.count ?? 0;
  if (finalCount > 0 && screened === 0 && profilesScreened != null && profilesScreened > 0) {
    return true;
  }
  if (finalCount > 0 && screened === 0 && profilesScreened == null) {
    const hasNonZero = pipeline.some((s) => s.count > 0);
    if (!hasNonZero) return true;
  }
  return false;
}

/** Real pipeline counts from CampaignObject creators — never fabricated ratios. */
export function resolveDiscoveryPipeline(
  campaignObject: CampaignObject | undefined,
  isSearching: boolean
): DiscoveryPipelineStage[] {
  const creatorsData = readCreatorsData(campaignObject);

  if (hasApprovedVendorFunnel(creatorsData)) {
    return creatorsData.vendorDiscoveryFunnel!;
  }

  const { discoveryIds, recommendationCount, profilesScreened } =
    resolveCreatorCounts(campaignObject);

  const stored = creatorsData.discoveryPipeline ?? [];
  const finalCount = recommendationCount > 0 ? recommendationCount : discoveryIds.length;
  if (
    stored.length > 0 &&
    !isContradictoryPipeline(stored, profilesScreened, finalCount)
  ) {
    return stored;
  }

  const matchedCount = discoveryIds.length > 0 ? discoveryIds.length : null;
  const qualifiedCount =
    recommendationCount > 0
      ? recommendationCount
      : matchedCount;
  const rankedCount = recommendationCount > 0 ? recommendationCount : null;
  const recommendedCount = recommendationCount > 0 ? recommendationCount : null;

  const rawCounts: Array<number | null> = [
    profilesScreened,
    profilesScreened,
    matchedCount,
    qualifiedCount,
    rankedCount,
    recommendedCount,
  ];

  const hasAnyCount = rawCounts.some((c) => c != null && c > 0);
  let lastCompleteIndex = -1;
  for (let i = rawCounts.length - 1; i >= 0; i -= 1) {
    if (rawCounts[i] != null && rawCounts[i]! > 0) {
      lastCompleteIndex = i;
      break;
    }
  }

  return DISCOVERY_PIPELINE_STAGE_DEFS.map((stage, index) => {
    const raw = rawCounts[index];
    const count = raw != null && raw > 0 ? raw : 0;

    let status: DiscoveryPipelineStage["status"] = "pending";
    if (hasAnyCount && count > 0 && index <= lastCompleteIndex) {
      status = "complete";
    } else if (isSearching && !hasAnyCount) {
      const activeIndex = 1;
      if (index < activeIndex) status = "complete";
      else if (index === activeIndex) status = "active";
    } else if (isSearching && hasAnyCount && index === lastCompleteIndex + 1) {
      status = "active";
    }

    return { id: stage.id, label: stage.label, count, status };
  });
}

function isEmptyVendorRationale(text: string | undefined): boolean {
  if (!text?.trim()) return true;
  return /no creators available/i.test(text);
}

function readCampaignBriefText(campaignObject?: CampaignObject): string {
  if (!campaignObject) return "";
  const parts: string[] = [];
  const summary = campaignObject.sections.summary.content;
  const strategy = campaignObject.sections.strategy.content;
  if (typeof summary === "string") parts.push(summary);
  if (typeof strategy === "string") parts.push(strategy);
  return parts.join("\n");
}

export function resolveCampaignObjectCurrency(campaignObject?: CampaignObject): string {
  const facts = getCampaignFacts(campaignObject);
  if (facts?.budget?.currency) {
    return resolveFactsCurrency(facts);
  }

  const budget = campaignObject?.sections.budget;
  const budgetCurrency = isBudgetSectionData(budget?.content)
    ? budget.content.currency
    : undefined;
  const summaryCards = readSummaryCards(campaignObject);
  const textSources = [
    summaryCards?.budget,
    typeof budget?.content === "string" ? budget.content : undefined,
    typeof campaignObject?.sections.summary.content === "string"
      ? campaignObject.sections.summary.content
      : undefined,
    typeof campaignObject?.sections.strategy.content === "string"
      ? campaignObject.sections.strategy.content
      : undefined,
  ];
  return resolveCampaignCurrency(budgetCurrency, ...textSources);
}

function localizeBenchmarkData(
  benchmark: IndustryBenchmarkData,
  currency: string
): IndustryBenchmarkData {
  if (currency.toUpperCase() === "USD") return benchmark;
  return {
    ...benchmark,
    estCpm: localizeMoneyString(benchmark.estCpm, currency),
    estCpc: localizeMoneyString(benchmark.estCpc, currency),
    budgetEfficiency: localizeMoneyString(benchmark.budgetEfficiency, currency),
    comparisons: benchmark.comparisons.map((row) => ({
      ...row,
      expected: localizeMoneyString(row.expected, currency),
      industry: localizeMoneyString(row.industry, currency),
    })),
  };
}

function readSectionString(content: string | Record<string, unknown>): string {
  return typeof content === "string" ? content : "";
}

export type CampaignSummaryData = SummarySectionData;

export type ExecutiveStrategyData = {
  businessChallenge?: string;
  objective?: string;
  targetAudience?: string;
  audiencePersonas?: string[];
  consumerInsight?: string;
  keyMessage?: string;
  communicationPillars?: string[];
  contentPillars?: string[];
  creatorStrategy?: string;
  platformStrategy?: string;
  customerJourney?: string;
  successFactors?: string[];
  competitiveAdvantage?: string;
  keyMessages?: string[];
  platformMix?: string[];
  creatorMix?: string[];
  deliverables?: string[];
  expectedOutcomes?: string[];
};

export type ParsedVendor = {
  id?: string;
  rank?: number;
  displayName: string;
  handle: string;
  platform: string;
  followers?: number;
  engagementRate?: number;
  fitScore?: number;
  reason?: string;
  priceEstimate?: string;
};

export type VendorDiscoveryData = {
  phase?: string;
  total: number;
  candidateCount: number;
  profilesScreened: number | null;
  isSearching: boolean;
  pipeline: DiscoveryPipelineStage[];
};

export type EnhancedRiskData = RiskAnalysisSectionData & {
  enrichedRisks?: OperationsSectionExtras["enrichedRisks"];
};

export type EnhancedTimelineData = {
  durationWeeks: number;
  goLiveWeek?: number;
  weeks: TimelineWeekDetail[];
};

function sanitizeTimelineWeek(week: TimelineWeekDetail): TimelineWeekDetail {
  return {
    ...week,
    phase: sanitizeTimelineText(week.phase),
    activities: week.activities.map(sanitizeTimelineText).filter(Boolean),
    deliverables: week.deliverables.map(sanitizeTimelineText).filter(Boolean),
    milestones: week.milestones.map(sanitizeTimelineText).filter(Boolean),
    owner: sanitizeTimelineText(week.owner),
    dependencies: week.dependencies.map(sanitizeTimelineText).filter(Boolean),
    approvalGates: week.approvalGates.map(sanitizeTimelineText).filter(Boolean),
  };
}

function sanitizeTimelineWeeks(weeks: TimelineWeekDetail[]): TimelineWeekDetail[] {
  return weeks.map(sanitizeTimelineWeek);
}

export type EnhancedBudgetData = BudgetSectionData & BudgetSectionExtras & {
  budgetPlannerReasoning?: string;
};

function readSummaryCards(campaignObject?: CampaignObject): SummarySectionData | null {
  if (!campaignObject) return null;
  const data = campaignObject.sections.summary.data?.summaryCards;
  return isSummarySectionData(data) ? data : null;
}

function readStrategyData(campaignObject?: CampaignObject) {
  if (!campaignObject) return null;
  const data = campaignObject.sections.strategy.data;
  return isStrategySectionData(data) ? data : null;
}

function readPerformanceData(campaignObject?: CampaignObject) {
  if (!campaignObject) return null;
  const data = campaignObject.sections.performance.data;
  return isPerformanceSectionData(data) ? data : null;
}

function readBudgetExtras(campaignObject?: CampaignObject): BudgetSectionExtras | null {
  if (!campaignObject) return null;
  const data = campaignObject.sections.budget.data;
  return isBudgetSectionExtras(data) ? data : null;
}

function readTimelineExtras(campaignObject?: CampaignObject) {
  if (!campaignObject) return null;
  const data = campaignObject.sections.timeline.data;
  return isTimelineSectionExtras(data) ? data : null;
}

function readPresentationExtras(campaignObject?: CampaignObject) {
  if (!campaignObject) return null;
  const data = campaignObject.sections.presentation.data;
  return isPresentationSectionExtras(data) ? data : null;
}

export function resolveCampaignSummary(
  campaignObject?: CampaignObject
): CampaignSummaryData | null {
  const cards = readSummaryCards(campaignObject);
  if (cards) return cards;

  const facts = getCampaignFacts(campaignObject);
  if (!facts) return null;

  const derived = applyFactsToSummaryData({}, facts);
  return Object.values(derived).some((value) => Boolean(String(value ?? "").trim()))
    ? derived
    : null;
}

export function resolveExecutiveStrategy(
  campaignObject?: CampaignObject
): ExecutiveStrategyData | null {
  const strategyData = readStrategyData(campaignObject);
  if (!strategyData?.groundedFields?.length) return null;

  const byLabel = Object.fromEntries(
    strategyData.groundedFields.map((field) => [field.label, field.value])
  );

  return {
    businessChallenge: byLabel["Business Challenge"],
    objective: byLabel["Campaign Objective"],
    targetAudience: byLabel["Target Audience"],
    consumerInsight: byLabel["Consumer Insight"],
    keyMessage: byLabel["Key Message"],
    creatorStrategy: byLabel["Creator Strategy"],
    platformStrategy: byLabel["Platform Strategy"],
    customerJourney: byLabel["Customer Journey"],
    competitiveAdvantage: byLabel["Competitive Advantage"],
  };
}

export function resolveVendorDiscovery(
  campaignObject: CampaignObject | undefined,
  isRunning: boolean
): VendorDiscoveryData {
  const creatorsData = readCreatorsData(campaignObject);
  const { discoveryIds, recommendationCount, profilesScreened } =
    resolveCreatorCounts(campaignObject);
  const isSearching = isRunning || creatorsData.phase === "discovery";
  const finalCount =
    recommendationCount > 0 ? recommendationCount : discoveryIds.length;

  return {
    phase: creatorsData.phase,
    total: finalCount,
    candidateCount: discoveryIds.length,
    profilesScreened,
    isSearching,
    pipeline: resolveDiscoveryPipeline(campaignObject, isSearching),
  };
}

export function resolveVendorRecommendations(
  campaignObject: CampaignObject | undefined
): ParsedVendor[] {
  if (!campaignObject) return [];

  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const displayText = creatorsData.recommendationsDisplay?.trim();
  if (!displayText) return [];
  if (/no vendors available to recommend/i.test(displayText)) return [];

  const facts = getCampaignFacts(campaignObject);
  const defaultPlatform = facts?.platforms?.[0] ?? "instagram";
  const currency = resolveInfluencerEstimateCurrency(facts);

  return displayText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /@[\w.]{2,}/.test(line) && !/\*\*Criteria/i.test(line))
    .map((line, index) => {
      const handleMatch = line.match(/@([\w.]+)/);
      const bareHandle = handleMatch?.[1];
      const handle = bareHandle ? `@${bareHandle}` : `@vendor-${index + 1}`;
      const leadingName = line
        .replace(/^[-*•\d.]+\s*/, "")
        .split(/[@(]/)[0]
        ?.trim();
      const displayName =
        leadingName && leadingName.length > 1 && !/^vendor[-\s]?\d+$/i.test(leadingName)
          ? leadingName
          : bareHandle
            ? humanizeCreatorHandle(bareHandle)
            : `Creator ${index + 1}`;
      const platform = parsePlatformFromRecommendationLine(line) ?? defaultPlatform;
      const followerToken = line.match(/([\d,.]+)\s*([KMB])\b/i);
      const followers = followerToken
        ? parseCompactFollowerCount(`${followerToken[1]}${followerToken[2] ?? ""}`)
        : undefined;
      const engagementMatch = line.match(/([\d.]+)\s*%\s*engagement/i);
      const engagementRate = engagementMatch?.[1]
        ? Number.parseFloat(engagementMatch[1])
        : undefined;
      const fitMatch = line.match(/fit\s*(\d{1,3})\s*\/\s*100/i);
      const fitScore = fitMatch?.[1] ? Number.parseInt(fitMatch[1], 10) : undefined;
      return {
        rank: index + 1,
        displayName,
        handle,
        platform,
        followers,
        engagementRate:
          engagementRate != null && Number.isFinite(engagementRate) ? engagementRate : undefined,
        fitScore,
        reason: line,
        priceEstimate: estimateCreatorPostFee({
          platform,
          currency,
          followers,
        }),
      };
    });
}

export function resolveCreatorIds(
  campaignObject: CampaignObject | undefined,
  options?: { recommendationsOnly?: boolean }
): {
  ids: string[];
  rationale?: string;
  avgFitScore?: number;
  creatorFitScores?: Record<string, number>;
} {
  const creatorsData = readCreatorsData(campaignObject);
  const { recommendationIds, discoveryIds } = resolveCreatorCounts(campaignObject);
  const ids =
    recommendationIds.length > 0
      ? recommendationIds
      : options?.recommendationsOnly
        ? []
        : discoveryIds;
  return {
    ids,
    rationale: creatorsData.recommendations?.rationale,
    avgFitScore: creatorsData.recommendations?.avgFitScore,
    creatorFitScores: creatorsData.recommendations?.creatorFitScores,
  };
}

export function resolveBudgetData(
  campaignObject: CampaignObject | undefined
): EnhancedBudgetData | null {
  if (!campaignObject) return null;

  const section = campaignObject.sections.budget;
  const extras = readBudgetExtras(campaignObject);
  const facts = getCampaignFacts(campaignObject);
  let content: BudgetSectionData | null = null;

  if (isBudgetSectionData(section.content)) {
    content = section.content;
  } else if (facts) {
    const contextText = readCampaignBriefText(campaignObject);
    content = buildBudgetSectionDataFromFacts(facts, contextText);
  } else {
    const text = readSectionString(section.content);
    if (text.trim()) {
      content = buildBudgetSectionData(text, (section.data ?? {}) as Record<string, unknown>);
    }
  }

  if (facts && content) {
    const factsBudget = buildBudgetSectionDataFromFacts(
      facts,
      readCampaignBriefText(campaignObject)
    );
    content = {
      ...content,
      currency: factsBudget.currency,
      total: factsBudget.total ?? content.total,
    };
  }

  if ((!content || content.allocations.length === 0) && extras?.groundedAllocations?.length) {
    const text = readSectionString(section.content);
    const currency = content?.currency ?? detectCurrencyFromText(text) ?? "USD";
    content = {
      currency,
      allocations: extras.groundedAllocations.map((line) => ({
        category: line.category,
        amount: line.amount,
        percent: line.percent,
      })),
      total:
        extras.groundedAllocations.reduce((sum, line) => sum + (line.amount ?? 0), 0) || undefined,
    };
  }

  if (!content || content.allocations.length === 0) return null;

  const currency = resolveCampaignObjectCurrency(campaignObject);
  const normalizedAllocations = normalizeBudgetAllocationPercents(content.allocations, content.total);
  const normalizedContent = {
    ...content,
    currency,
    allocations: normalizedAllocations,
  };

  const approvedAllocations = extras?.allocationReasoning;
  const groundedAllocations =
    approvedAllocations && approvedAllocations.length > 0
      ? allocationReasoningToGrounded(approvedAllocations)
      : extras?.groundedAllocations;

  return {
    ...normalizedContent,
    groundedAllocations,
    budgetPlannerReasoning: extras?.budgetPlannerReasoning,
    cpmAssumption: extras?.cpmAssumption
      ? localizeMoneyString(extras.cpmAssumption, currency)
      : undefined,
    cpeAssumption: extras?.cpeAssumption
      ? localizeMoneyString(extras.cpeAssumption, currency)
      : undefined,
  };
}

function isCampaignTimelineComplete(campaignObject: CampaignObject): boolean {
  const workflowStatus = campaignObject.meta.workflowStatus;
  const metaStatus = campaignObject.meta.status;
  const timelineStatus = campaignObject.sections.timeline.status;
  return (
    workflowStatus === "completed" ||
    workflowStatus === "complete" ||
    metaStatus === "complete" ||
    timelineStatus === "complete"
  );
}

export function resolveTimelineData(
  campaignObject: CampaignObject | undefined
): EnhancedTimelineData | null {
  if (!campaignObject) return null;

  const section = campaignObject.sections.timeline;
  const facts = getCampaignFacts(campaignObject);
  const summaryText = readSectionString(campaignObject.sections.summary.content);
  const strategyText = readSectionString(campaignObject.sections.strategy.content);
  const timelineText = readSectionString(section.content);
  const summaryCards = readSummaryCards(campaignObject);
  const timelineExtras = readTimelineExtras(campaignObject);
  const approvedTimeline = timelineExtras?.creatorActivationTimeline;
  const isComplete = isCampaignTimelineComplete(campaignObject);

  if (approvedTimeline?.activationWeeks?.length) {
    const durationWeeks = approvedTimeline.durationWeeks;
    const weeks = activationTimelineToWeeks(approvedTimeline, isComplete);
    return {
      durationWeeks,
      goLiveWeek: resolveGoLiveWeek(durationWeeks),
      weeks: sanitizeTimelineWeeks(weeks),
    };
  }

  const durationFromFacts = facts ? resolveFactsDurationWeeks(facts) : undefined;
  const durationFromSummaryCards = summaryCards?.duration
    ? clampCampaignDurationWeeks(parseInt(summaryCards.duration, 10))
    : undefined;
  const durationWeeks =
    durationFromFacts ??
    durationFromSummaryCards ??
    resolveCampaignDurationWeeks(summaryText, strategyText, timelineText, facts);
  const industry = detectIndustryFromBrief([summaryText, strategyText].filter(Boolean).join("\n"));
  const goLiveWeek = resolveGoLiveWeek(durationWeeks);
  const milestones = isTimelineSectionData(section.content) ? section.content.milestones : [];
  const { weeks } = buildTimelineWeeksForCampaign(durationWeeks, industry, milestones, {
    isComplete,
  });

  if (weeks.length > 0) {
    return {
      durationWeeks,
      goLiveWeek,
      weeks: sanitizeTimelineWeeks(weeks),
    };
  }

  const combined = [timelineText, strategyText, summaryText].filter(Boolean).join("\n");
  if (combined.trim()) {
    const fallbackDuration = resolveCampaignDurationWeeks(
      summaryText,
      strategyText,
      timelineText,
      facts
    );
    const fallbackWeeks = buildTimelineWeeksForCampaign(
      fallbackDuration,
      detectIndustryFromBrief(combined),
      milestones,
      { isComplete: isCampaignTimelineComplete(campaignObject) }
    ).weeks;
    if (fallbackWeeks.length > 0) {
      return {
        durationWeeks: fallbackDuration,
        goLiveWeek: resolveGoLiveWeek(fallbackDuration),
        weeks: sanitizeTimelineWeeks(fallbackWeeks),
      };
    }
  }

  return null;
}

export function resolveKpiData(
  campaignObject: CampaignObject | undefined
): KpiForecastSectionData | null {
  if (!campaignObject) return null;
  const content = campaignObject.sections.performance.content;
  if (isKpiForecastSectionData(content) && content.kpis.length > 0) return content;
  return null;
}

export function resolveGroundedKpis(
  campaignObject: CampaignObject | undefined
): GroundedKpi[] {
  const performanceData = readPerformanceData(campaignObject);

  if (performanceData?.campaignForecast) {
    return forecastSnapshotToGroundedKpis(performanceData.campaignForecast);
  }

  const storedGrounded = performanceData?.groundedKpis ?? [];
  if (storedGrounded.length > 0) {
    return storedGrounded;
  }

  const approvedKpis = performanceData?.kpiReasoning;
  if (approvedKpis?.length) {
    return kpiReasoningToGrounded(approvedKpis);
  }

  const facts = getCampaignFacts(campaignObject);
  if (facts) {
    const factsKpis = buildGroundedKpisFromFacts(facts);
    if (factsKpis.length > 0) return factsKpis;
  }

  return [];
}

/** Read persisted campaign optimization report from performance section. */
export function resolveCampaignOptimization(
  campaignObject: CampaignObject | undefined
): import("@/lib/campaign-optimization").CampaignOptimizationSnapshot | null {
  const performanceData = readPerformanceData(campaignObject);
  return performanceData?.campaignOptimization ?? null;
}

/** Read persisted campaign decision report from performance section. */
export function resolveCampaignDecision(
  campaignObject: CampaignObject | undefined
): import("@/lib/campaign-decision").CampaignDecisionSnapshot | null {
  const performanceData = readPerformanceData(campaignObject);
  return performanceData?.campaignDecision ?? null;
}

/** Read persisted campaign strategy from strategy section. */
export function resolveCampaignStrategy(
  campaignObject: CampaignObject | undefined
): import("@/lib/campaign-planning").CampaignStrategySnapshot | null {
  if (!campaignObject) return null;
  const data = campaignObject.sections.strategy.data as StrategySectionData | undefined;
  return data?.generatedStrategy ?? null;
}

export function resolveRiskData(
  campaignObject: CampaignObject | undefined
): EnhancedRiskData | null {
  if (!campaignObject) return null;

  const section = campaignObject.sections.operations;
  const enrichedRisks = section.data?.enrichedRisks as EnhancedRiskData["enrichedRisks"];

  if (isRiskAnalysisSectionData(section.content) && section.content.risks.length > 0) {
    return { ...section.content, enrichedRisks };
  }

  if (enrichedRisks?.length) {
    const highCount = enrichedRisks.filter((item) => item.severity === "high").length;
    return {
      risks: enrichedRisks.map((item) => ({
        risk: item.risk,
        severity: item.severity,
        mitigation: item.mitigation,
        category: item.impact,
      })),
      overallRiskLevel: highCount >= 2 ? "high" : highCount >= 1 ? "medium" : "low",
      enrichedRisks,
    };
  }

  const budget = resolveBudgetData(campaignObject);
  if (budget) {
    const strategyText = readSectionString(campaignObject.sections.strategy.content);
    return buildRiskAnalysisFromBudget(budget, strategyText);
  }

  return null;
}

export function resolveCreativeConcepts(
  campaignObject: CampaignObject | undefined
): CreativeConcept[] {
  return readStrategyData(campaignObject)?.creativeConcepts ?? [];
}

export function resolveContentPlan(
  campaignObject: CampaignObject | undefined
): ContentPlanItem[] {
  return readTimelineExtras(campaignObject)?.contentPlan ?? [];
}

export function resolveCreatorMix(
  campaignObject: CampaignObject | undefined
): CreatorMixTier[] {
  const strategyMix = readStrategyData(campaignObject)?.creatorMix;
  if (strategyMix?.length) {
    return dedupeCreatorMixTiers(strategyMix);
  }

  const facts = getCampaignFacts(campaignObject);
  if (facts) {
    return buildCreatorMixFromFacts(facts);
  }

  return [];
}

export function resolveWhyAi(
  campaignObject: CampaignObject | undefined
): WhyAiInsight[] {
  return readStrategyData(campaignObject)?.whyAiInsights ?? [];
}

export function resolveDirectorDecisionMinutes(
  campaignObject: CampaignObject | undefined
): import("@/features/campaign-intelligence/types/section-schemas").DirectorDecisionMinute[] {
  return readStrategyData(campaignObject)?.directorDecisionMinutes ?? [];
}

export function resolveExecutiveStrategyReasoning(
  campaignObject: CampaignObject | undefined
): import("@/features/campaign-intelligence/types/section-schemas").ExecutiveStrategyReasoning | null {
  return readStrategyData(campaignObject)?.executiveStrategyReasoning ?? null;
}

export function resolvePresentationCompletion(
  campaignObject: CampaignObject | undefined
): { sectionsComplete: number; totalSections: number; completionPercent: number; version: string } {
  const completion = readPresentationExtras(campaignObject)?.completion;
  if (completion) return completion;

  const totalSections = campaignObject ? Object.keys(campaignObject.sections).length : 17;
  const sectionsComplete = campaignObject
    ? Object.values(campaignObject.sections).filter((s) => s.status === "complete").length
    : 0;

  return {
    sectionsComplete,
    totalSections,
    completionPercent: Math.round((sectionsComplete / totalSections) * 100),
    version: "v1.0",
  };
}

function parseCampaignTitleFromBrief(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const nameMatch = trimmed.match(
    /Campaign Name(?:\s*\([^)]*\))?\s*[:：]\s*["']?([^"'\n.]+)/i
  );
  if (nameMatch?.[1]?.trim()) return nameMatch[1].trim();

  const briefMatch = trimmed.match(
    /Campaign Brief:\s*[^–-]+[–-]\s*(.+?)(?:\.|Brand:)/i
  );
  if (briefMatch?.[1]?.trim()) return briefMatch[1].trim();

  const regionDriveMatch = trimmed.match(
    /([A-Za-z][A-Za-z0-9\s]{2,40}\s+(?:Dominance\s+)?Drive)/i
  );
  if (regionDriveMatch?.[1]?.trim()) return regionDriveMatch[1].trim();

  const dashMatch = trimmed.match(
    /[–-]\s*([A-Za-z0-9][^.\n]{6,90}?(?:Drive|Campaign|Launch|Initiative|Program))/i
  );
  return dashMatch?.[1]?.trim();
}

function isGenericCampaignTitle(title: string, brand?: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return true;
  if (brand && normalized === brand.trim().toLowerCase()) return true;
  if (brand && normalized === `${brand.trim().toLowerCase()} campaign`) return true;
  return normalized === "campaign" || normalized.endsWith(" campaign");
}

function looksLikeMarketingObjective(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;
  if (/\b(drive|launch|initiative|program|dominance)\b/i.test(normalized)) return false;
  return /awareness|engagement|consideration|conversion|reach|ugc|brand building/i.test(
    normalized
  );
}

function resolveCampaignNameCandidate(
  campaignObject: CampaignObject,
  brand?: string
): string | undefined {
  const facts = getCampaignFacts(campaignObject);
  const summaryText = readSectionString(campaignObject.sections.summary.content);
  const stored = isPresentationStatusSectionData(
    campaignObject.sections.presentation.content
  )
    ? campaignObject.sections.presentation.content
    : null;

  const candidates = [
    stored?.campaignName,
    parseCampaignTitleFromBrief(summaryText),
    parseCampaignTitleFromBrief(facts?.rawBriefExcerpt ?? ""),
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    if (isGenericCampaignTitle(trimmed, brand)) continue;
    if (looksLikeMarketingObjective(trimmed)) continue;
    return trimmed;
  }

  return undefined;
}

/** Meta bar title — brand + campaign name (reference: "Dolphin Tuna — Delta Region Dominance Drive"). */
export function resolveStudioCampaignDisplayTitle(
  campaignObject?: CampaignObject | null
): string | undefined {
  if (!campaignObject) return undefined;

  const facts = getCampaignFacts(campaignObject);
  const presentation = resolvePresentationData(campaignObject);
  const summary = resolveCampaignSummary(campaignObject);

  const brand =
    facts?.brandName?.trim() ||
    presentation?.brandName?.trim() ||
    summary?.brand?.trim() ||
    facts?.clientName?.trim();

  const title = resolveCampaignNameCandidate(campaignObject, brand);

  if (brand && title && title.toLowerCase() !== brand.toLowerCase()) {
    return `${brand} — ${title}`;
  }

  return brand || title;
}

/** Progress ring subtitle — reference uses "READY" from ~75% section completion upward. */
export function resolveStudioReadinessLabel(percent: number): "Ready" | "Building" {
  return percent >= 75 ? "Ready" : "Building";
}

export function resolvePresentationData(
  campaignObject: CampaignObject | undefined
): PresentationStatusSectionData | null {
  if (!campaignObject) return null;

  const section = campaignObject.sections.presentation;
  const summaryCards = readSummaryCards(campaignObject);
  const completion = resolvePresentationCompletion(campaignObject);
  const text = readSectionString(section.content);
  const summaryText = readSectionString(campaignObject.sections.summary.content);
  const workflowStatus = campaignObject.meta.workflowStatus;
  const stored = isPresentationStatusSectionData(section.content) ? section.content : null;

  const facts = getCampaignFacts(campaignObject);
  const brandName = getCampaignFactsOrLegacy(
    campaignObject,
    (f) => resolveFactsBrandName(f) ?? resolveFactsClientName(f),
    () =>
      summaryCards?.brand ??
      summaryCards?.client ??
      parseBrandFromText(summaryText) ??
      stored?.brandName
  );
  const campaignName =
    stored?.campaignName?.trim() ||
    parseCampaignTitleFromBrief(summaryText) ||
    parseCampaignTitleFromBrief(facts?.rawBriefExcerpt ?? "");

  if (
    stored ||
    section.status === "complete" ||
    text.trim() ||
    completion.completionPercent > 0
  ) {
    return {
      status:
        workflowStatus === "completed" || workflowStatus === "complete"
          ? "ready"
          : stored?.status ??
            (completion.completionPercent >= 100 ? "awaiting_approval" : "draft"),
      campaignName,
      brandName,
      lineCount: stored?.lineCount,
      message:
        text.trim() ||
        stored?.message ||
        `Campaign presentation ${completion.completionPercent}% complete — ready for review`,
      nextStep: stored?.nextStep,
    };
  }

  return null;
}

export function resolveGroundedStrategyFields(
  campaignObject: CampaignObject | undefined
): GroundedStrategyField[] {
  const reasoning = resolveExecutiveStrategyReasoning(campaignObject);
  if (reasoning?.chosenStrategy) {
    return executiveStrategyReasoningToFields(reasoning);
  }
  return readStrategyData(campaignObject)?.groundedFields ?? [];
}

export function resolveIndustryBenchmark(
  campaignObject: CampaignObject | undefined
): IndustryBenchmarkData | null {
  const benchmark = readPerformanceData(campaignObject)?.industryBenchmark ?? null;
  if (!benchmark) return null;
  const currency = resolveCampaignObjectCurrency(campaignObject);
  return localizeBenchmarkData(benchmark, currency);
}

export function resolveSuccessProbability(
  campaignObject: CampaignObject | undefined
): SuccessProbabilityData | null {
  return readPerformanceData(campaignObject)?.successProbability ?? null;
}

export function resolveOpportunities(
  campaignObject: CampaignObject | undefined
): OpportunityItem[] {
  return readStrategyData(campaignObject)?.opportunities ?? [];
}

export function resolveExecutiveSummaryData(
  campaignObject: CampaignObject | undefined
): ExecutiveSummaryData | null {
  return readPresentationExtras(campaignObject)?.executiveSummary ?? null;
}

export function resolveVendorGrounding(
  vendor: VendorFactorInput,
  campaignObject: CampaignObject | undefined,
  index: number
): GroundedVendor {
  const creatorsData = (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
  const selectedReasoning = findSelectedReasoning(
    creatorsData.recommendations?.selectedReasoning,
    vendor,
    index
  );

  const industry = detectIndustryFromBrief(readCampaignBriefText(campaignObject));
  const derived = deriveVendorRankingFactors(vendor, industry, index);

  if (selectedReasoning?.whySelected?.trim()) {
    return {
      creatorId: selectedReasoning.creatorId,
      rank: index + 1,
      whySelected: selectedReasoning.whySelected,
      factors: derived.factors,
      grounding: {
        source: "AI",
        confidence: selectedReasoning.confidence,
        reason: selectedReasoning.evidence || selectedReasoning.tradeoff,
        evidence: selectedReasoning.evidence,
      },
    };
  }

  const stored = creatorsData.recommendations?.creatorIds?.length
    ? (campaignObject?.sections.creators.data?.vendorGrounding as GroundedVendor[] | undefined)
    : undefined;

  const match = stored?.find(
    (entry) => entry.creatorId === vendor.handle || entry.rank === index + 1
  );

  if (match && !isEmptyVendorRationale(match.whySelected)) {
    return {
      ...match,
      factors: match.factors?.length ? match.factors : derived.factors,
      grounding: match.grounding?.reason ? match.grounding : derived.grounding,
    };
  }

  const rationale = isEmptyVendorRationale(vendor.rationale) ? undefined : vendor.rationale;
  if (rationale) {
    return {
      creatorId: vendor.handle,
      rank: index + 1,
      whySelected: rationale,
      factors: derived.factors,
      grounding: derived.grounding,
    };
  }

  return {
    creatorId: vendor.handle,
    rank: index + 1,
    whySelected: derived.whySelected,
    factors: derived.factors,
    grounding: derived.grounding,
  };
}

export function sectionSkeletonVariant(
  sectionId: CampaignStudioSectionId
): "cards" | "chart" | "timeline" | "pipeline" | "vendors" {
  switch (sectionId) {
    case "creator-discovery":
      return "pipeline";
    case "creator-recommendations":
      return "vendors";
    case "budget-planner":
      return "chart";
    case "timeline":
      return "timeline";
    case "creative-concepts":
    case "content-plan":
    case "creator-mix":
    case "why-ai":
    case "industry-benchmark":
    case "success-probability":
    case "opportunity-finder":
    case "executive-summary":
      return "cards";
    default:
      return "cards";
  }
}

export type { CreativeConcept, ContentPlanItem, CreatorMixTier, WhyAiInsight };
