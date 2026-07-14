import {
  detectCurrencyFromSources,
  parseAudienceFromText,
  parseBrandFromText,
  parseBudgetTotalFromText,
  parseDurationFromText,
  parseMarketFromText,
  parseObjectiveFromText,
  parseProductFromText,
  stripMarkdown,
} from "@/features/campaign-studio/components/sections/shared/format-utils";
import {
  applyFactsToSummaryData,
  buildBudgetSectionDataFromFacts,
  buildCreatorMixFromFacts,
  buildCreatorMixFromReasoningTiers,
  buildGroundedKpisFromFacts,
  buildTimelineSectionDataFromFacts,
  getCampaignFacts,
  hasCampaignFacts,
  resolveFactsDurationWeeks,
} from "@/features/campaign-director/facts/facts-display-bridge";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { writeStrategyDocumentFromBrief } from "@/features/campaign-director/services/strategy-document";
import { buildIs1ReasoningBundle } from "@/features/campaign-intelligence/services/reasoning";
import {
  detectIndustryFromBrief,
  getBudgetAllocationReason,
  getGroundedKpis,
  getIndustryBenchmarks,
  getIndustryProfile,
  getIndustryRisks,
  resolveClientFromBrief,
} from "@/features/campaign-studio/services/industry-intelligence";
import {
  buildTimelineWeeksForCampaign,
  deriveContentPlan,
  deriveCreativeConcepts,
  deriveCreatorMix,
  deriveDiscoveryPipeline,
  deriveExecutiveSummary,
  deriveGroundedStrategy,
  deriveOpportunities,
  deriveSuccessProbability,
  deriveVendorRankingFactors,
  deriveWhyAiInsights,
  type VendorFactorInput,
} from "@/features/campaign-studio/services/presentation-intelligence";
import { resolveCampaignDurationWeeks } from "@/features/campaign-studio/services/timeline-duration";
import {
  filterCelebrityMixTiers,
  sanitizeLegacyReachValue,
  stripCelebrityFromLabel,
} from "@/features/campaign-studio/services/campaign-render-model";
import {
  deriveInfluencerBudgetAllocations,
  normalizeBudgetAllocationPercents,
} from "@/features/campaign-studio/services/budget-allocation";

import type { CampaignObject, CampaignObjectSections } from "../types/campaign-object";
import type {
  BudgetSectionData,
  BudgetSectionExtras,
  CreatorsSectionData,
  GroundedVendor,
  OperationsSectionExtras,
  PerformanceSectionData,
  PresentationSectionExtras,
  StrategySectionData,
  SummarySectionData,
  TimelineSectionData,
  TimelineSectionExtras,
} from "../types/section-schemas";
import { isBudgetSectionData, isTimelineSectionData } from "../types/section-schemas";
import { buildBudgetSectionData } from "./structured-section-builders";

function stringContent(content: string | Record<string, unknown>): string {
  return typeof content === "string" ? content : "";
}

function hasApprovedExecutiveStrategy(data?: StrategySectionData): boolean {
  return Boolean(data?.executiveStrategyReasoning?.chosenStrategy);
}

function hasApprovedDirectorMinutes(data?: StrategySectionData): boolean {
  return (data?.directorDecisionMinutes?.length ?? 0) > 0;
}

function hasApprovedCreatorMix(data?: StrategySectionData): boolean {
  return (data?.creatorMix?.length ?? 0) > 0;
}

function hasApprovedKpiReasoning(data?: PerformanceSectionData): boolean {
  return (data?.kpiReasoning?.length ?? 0) > 0;
}

function hasApprovedBudgetReasoning(data?: BudgetSectionExtras): boolean {
  return (
    (data?.allocationReasoning?.length ?? 0) > 0 || Boolean(data?.budgetPlannerReasoning?.trim())
  );
}

function hasApprovedActivationTimeline(data?: TimelineSectionExtras): boolean {
  return (data?.creatorActivationTimeline?.activationWeeks?.length ?? 0) > 0;
}

function hasApprovedVendorFunnel(data?: CreatorsSectionData): boolean {
  return (data?.vendorDiscoveryFunnel?.length ?? 0) > 0;
}

function hasDirectorOperationsRisks(
  content: CampaignObjectSections["operations"]["content"]
): boolean {
  return (
    typeof content === "object" &&
    content != null &&
    Array.isArray((content as { risks?: unknown[] }).risks) &&
    ((content as { risks: unknown[] }).risks.length ?? 0) > 0
  );
}

function cleanText(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return stripMarkdown(value.trim());
}

function resolveStrategyDocumentForFacts(
  campaignObject: CampaignObject,
  campaignFacts: CampaignFacts
): import("@/features/campaign-director/types").CampaignStrategyDocument {
  const summaryText = stringContent(campaignObject.sections.summary.content);
  return writeStrategyDocumentFromBrief(
    {
      rawMessage: summaryText || campaignFacts.rawBriefExcerpt || "",
      brandName: campaignFacts.brandName,
      clientName: campaignFacts.clientName,
      campaignFacts,
    },
    campaignFacts
  );
}

function applyIs1ReasoningToSections(
  sections: CampaignObjectSections,
  facts: CampaignFacts,
  strategy: import("@/features/campaign-director/types").CampaignStrategyDocument,
  contextText: string,
  creatorsData?: CreatorsSectionData
): CampaignObjectSections {
  const reasoning = buildIs1ReasoningBundle(facts, strategy, {
    briefText: contextText,
    finalCandidateCount:
      creatorsData?.discovery?.total ?? creatorsData?.recommendations?.creatorIds?.length ?? 0,
    isSearching: creatorsData?.phase === "discovery" && sections.creators.status === "working",
  });

  const mixTiers = buildCreatorMixFromReasoningTiers(reasoning.creatorMix.tiers);

  sections.strategy = {
    ...sections.strategy,
    data: {
      ...sections.strategy.data,
      executiveStrategyReasoning: reasoning.executiveStrategy,
      creatorMix: mixTiers,
      creatorMixReasoning: reasoning.creatorMix.tiers,
      creatorMixSummary: { whyMix: reasoning.creatorMix.whyMix },
      directorDecisionMinutes: reasoning.directorDecisionMinutes,
    },
  };

  sections.performance = {
    ...sections.performance,
    data: {
      ...sections.performance.data,
      kpiReasoning: reasoning.kpiForecast.kpis,
      industryBenchmark: reasoning.industryBenchmark,
      successProbability: reasoning.objectiveAchievement,
    },
  };

  sections.budget = {
    ...sections.budget,
    data: {
      ...sections.budget.data,
      allocationReasoning: reasoning.budgetPlanner.allocations,
      budgetPlannerReasoning: reasoning.budgetPlanner.directorRationale,
    },
  };

  sections.timeline = {
    ...sections.timeline,
    data: {
      ...sections.timeline.data,
      creatorActivationTimeline: reasoning.creatorActivationTimeline,
    },
  };

  const existingCreators = (sections.creators.data ?? {}) as CreatorsSectionData;
  sections.creators = {
    ...sections.creators,
    data: {
      ...existingCreators,
      vendorDiscoveryFunnel: reasoning.vendorDiscoveryFunnel,
      discoveryPipeline: reasoning.vendorDiscoveryFunnel,
      recommendations: existingCreators.recommendations
        ? {
            ...existingCreators.recommendations,
            selectedReasoning: reasoning.vendorRecommendations.selected,
            rejectedReasoning: reasoning.vendorRecommendations.rejected,
          }
        : reasoning.vendorRecommendations.selected.length > 0
          ? {
              creatorIds: reasoning.vendorRecommendations.selected.map((s) => s.creatorId),
              selectedReasoning: reasoning.vendorRecommendations.selected,
              rejectedReasoning: reasoning.vendorRecommendations.rejected,
            }
          : existingCreators.recommendations,
    },
  };

  return sections;
}

const SUMMARY_FIELD_PATTERNS: Array<{ key: keyof SummarySectionData; patterns: RegExp[] }> = [
  { key: "brand", patterns: [/^brand[:\s]+(.+)/im, /\*\*brand\*\*[:\s]+(.+)/im] },
  { key: "product", patterns: [/^product[:\s]+(.+)/im, /\*\*product\*\*[:\s]+(.+)/im] },
  { key: "market", patterns: [/^market[:\s]+(.+)/im, /\*\*market\*\*[:\s]+(.+)/im] },
  {
    key: "targetAudience",
    patterns: [
      /^target audience[:\s]+(.+)/im,
      /\*\*target audience\*\*[:\s]+(.+)/im,
      /^audience[:\s]+(.+)/im,
    ],
  },
  {
    key: "budget",
    patterns: [/^budget[:\s]+(.+)/im, /\*\*budget\*\*[:\s]+(.+)/im, /total budget[:\s]+(.+)/im],
  },
  {
    key: "duration",
    patterns: [/^duration[:\s]+(.+)/im, /\*\*duration\*\*[:\s]+(.+)/im],
  },
  {
    key: "objective",
    patterns: [/^objective[:\s]+(.+)/im, /\*\*objective\*\*[:\s]+(.+)/im],
  },
];

function extractField(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

export function buildSummarySectionData(
  briefText: string,
  audienceText: string,
  metaStatus?: string,
  budgetContent?: BudgetSectionData,
  campaignFacts?: import("@/features/campaign-director/facts/campaign-facts-types").CampaignFacts,
  options?: { preservedEstimatedReach?: string }
): SummarySectionData {
  const combined = [briefText, audienceText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const allowCelebrity = /celebrit/i.test(
    [combined, campaignFacts?.rawBriefExcerpt, campaignFacts?.objective].filter(Boolean).join("\n")
  );

  const data: SummarySectionData = {
    client: cleanText(resolveClientFromBrief(combined)),
    campaignType: profile.campaignType,
    platforms: profile.platforms.join(", "),
    creatorMix: stripCelebrityFromLabel(profile.creatorMixSummary, allowCelebrity),
    // Reach is never templated — it is either the value promoted from a
    // decision-workspace simulation or computed from the selected slate.
    estimatedReach: sanitizeLegacyReachValue(options?.preservedEstimatedReach),
  };

  if (campaignFacts) {
    const factsData = applyFactsToSummaryData(data, campaignFacts);
    if (metaStatus) {
      factsData.campaignStatus = metaStatus.replace(/_/g, " ");
    }
    return factsData;
  }

  for (const { key, patterns } of SUMMARY_FIELD_PATTERNS) {
    const value = extractField(combined, patterns);
    if (value) data[key] = cleanText(value);
  }

  if (!data.brand) data.brand = cleanText(parseBrandFromText(combined) ?? data.client);
  if (!data.product) data.product = cleanText(parseProductFromText(combined));
  if (!data.market) data.market = cleanText(parseMarketFromText(combined));
  if (!data.targetAudience) data.targetAudience = cleanText(parseAudienceFromText(combined));
  if (!data.duration) data.duration = cleanText(parseDurationFromText(combined));
  if (!data.objective) data.objective = cleanText(parseObjectiveFromText(combined));

  if (!data.budget) {
    if (budgetContent?.total) {
      data.budget = `${budgetContent.total.toLocaleString()} ${budgetContent.currency}`;
    } else {
      const total = parseBudgetTotalFromText(combined);
      const currency = detectCurrencyFromSources(combined);
      if (total) data.budget = `${total.toLocaleString()} ${currency}`;
    }
  }

  if (metaStatus) {
    data.campaignStatus = metaStatus.replace(/_/g, " ");
  }

  return data;
}

export function buildStrategySectionData(
  strategyText: string,
  audienceText: string,
  summaryText: string,
  campaignFacts?: import("@/features/campaign-director/facts/campaign-facts-types").CampaignFacts
): StrategySectionData {
  const allowCelebrity = /celebrit/i.test(
    [strategyText, summaryText, campaignFacts?.rawBriefExcerpt, campaignFacts?.objective]
      .filter(Boolean)
      .join("\n")
  );
  const durationWeeks = campaignFacts
    ? resolveFactsDurationWeeks(campaignFacts)
    : resolveCampaignDurationWeeks(summaryText, strategyText);
  const creatorMix = filterCelebrityMixTiers(
    campaignFacts
      ? buildCreatorMixFromFacts(campaignFacts)
      : deriveCreatorMix(strategyText, summaryText, undefined, { allowCelebrity }),
    allowCelebrity
  );

  return {
    groundedFields: deriveGroundedStrategy(strategyText, audienceText, summaryText),
    creativeConcepts: deriveCreativeConcepts(strategyText, summaryText, campaignFacts),
    creatorMix,
    opportunities: deriveOpportunities(strategyText, summaryText, { allowCelebrity }),
    whyAiInsights: deriveWhyAiInsights(strategyText, summaryText, undefined, durationWeeks),
  };
}

export function buildPerformanceSectionData(
  strategyText: string,
  audienceText: string,
  summaryText: string,
  campaignFacts?: import("@/features/campaign-director/facts/campaign-facts-types").CampaignFacts
): PerformanceSectionData {
  const combined = [strategyText, audienceText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);

  const factsKpis = campaignFacts ? buildGroundedKpisFromFacts(campaignFacts) : [];
  const groundedKpis =
    factsKpis.length > 0 ? factsKpis : getGroundedKpis(industry, combined);
  const durationWeeks = campaignFacts
    ? resolveFactsDurationWeeks(campaignFacts)
    : resolveCampaignDurationWeeks(summaryText, strategyText);

  return {
    groundedKpis,
    successProbability: deriveSuccessProbability(strategyText, summaryText, durationWeeks),
    industryBenchmark: getIndustryBenchmarks(industry, combined),
  };
}

export function buildBudgetSectionExtras(
  budget: BudgetSectionData,
  contextText: string
): BudgetSectionExtras {
  const industry = detectIndustryFromBrief(contextText);
  const profile = getIndustryProfile(industry, contextText);
  const total = budget.total ?? parseBudgetTotalFromText(contextText);

  const allocations =
    budget.allocations.some((a) => a.percent != null || a.amount != null)
      ? normalizeBudgetAllocationPercents(budget.allocations, total ?? undefined)
      : deriveInfluencerBudgetAllocations(industry, contextText, total ?? undefined);

  return {
    cpmAssumption: profile.cpmAssumption,
    cpeAssumption: profile.cpeAssumption,
    groundedAllocations: allocations.map((line) => {
      const reasonMeta = getBudgetAllocationReason(industry, line.category);
      return {
        category: line.category,
        percent: line.percent ?? 0,
        amount: line.amount,
        reason: reasonMeta.reason,
        source: reasonMeta.source,
        confidence: reasonMeta.confidence,
      };
    }),
  };
}

export function buildTimelineSectionExtras(
  timeline: TimelineSectionData,
  strategyText: string,
  summaryText: string,
  options?: { isComplete?: boolean; campaignFacts?: import("@/features/campaign-director/facts/campaign-facts-types").CampaignFacts }
): TimelineSectionExtras {
  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const durationWeeks = options?.campaignFacts
    ? resolveFactsDurationWeeks(options.campaignFacts)
    : resolveCampaignDurationWeeks(summaryText, strategyText);
  const { weeks } = buildTimelineWeeksForCampaign(
    durationWeeks,
    industry,
    timeline.milestones,
    { isComplete: options?.isComplete }
  );

  return {
    weekDetails: weeks,
    contentPlan: deriveContentPlan(strategyText, summaryText, durationWeeks),
  };
}

export function buildPresentationSectionExtras(
  strategyText: string,
  audienceText: string,
  summaryText: string,
  campaignObject: CampaignObject
): PresentationSectionExtras {
  const totalSections = Object.keys(campaignObject.sections).length;
  const sectionsComplete = Object.values(campaignObject.sections).filter(
    (s) => s.status === "complete"
  ).length;
  const campaignFacts = getCampaignFacts(campaignObject);
  const durationWeeks = campaignFacts
    ? resolveFactsDurationWeeks(campaignFacts)
    : resolveCampaignDurationWeeks(summaryText, strategyText);
  const allowCelebrity = /celebrit/i.test(
    [strategyText, summaryText, campaignFacts?.rawBriefExcerpt, campaignFacts?.objective]
      .filter(Boolean)
      .join("\n")
  );

  return {
    executiveSummary: deriveExecutiveSummary(strategyText, audienceText, summaryText, {
      facts: campaignFacts,
      durationWeeks,
      allowCelebrity,
    }),
    completion: {
      sectionsComplete,
      totalSections,
      completionPercent: Math.round((sectionsComplete / totalSections) * 100),
      version: campaignObject.updatedAt
        ? `v${new Date(campaignObject.updatedAt).toISOString().slice(0, 10).replace(/-/g, ".")}`
        : "v1.0",
    },
  };
}

export function buildOperationsSectionExtras(contextText: string): OperationsSectionExtras {
  const industry = detectIndustryFromBrief(contextText);
  return {
    enrichedRisks: getIndustryRisks(industry),
  };
}

export function buildCreatorDiscoveryPipeline(
  total: number,
  isSearching: boolean
): CreatorsSectionData["discoveryPipeline"] {
  return deriveDiscoveryPipeline(total, isSearching);
}

export function buildVendorGroundingData(
  vendor: VendorFactorInput,
  contextText: string,
  index: number
): GroundedVendor {
  const industry = detectIndustryFromBrief(contextText);
  const result = deriveVendorRankingFactors(vendor, industry, index);
  return {
    creatorId: vendor.handle,
    rank: index + 1,
    whySelected: result.whySelected,
    factors: result.factors,
    grounding: result.grounding,
  };
}

export function enrichCampaignObjectWithStudioData(
  campaignObject: CampaignObject
): CampaignObject {
  const sections: CampaignObjectSections = { ...campaignObject.sections };
  const summaryText = stringContent(sections.summary.content);
  const audienceText = stringContent(sections.audience.content);
  const strategyText = stringContent(sections.strategy.content);
  const campaignFacts = getCampaignFacts(campaignObject);
  const factsPresent = hasCampaignFacts(campaignObject);

  const contextText = [summaryText, audienceText, strategyText].filter(Boolean).join("\n");

  let budgetContent = isBudgetSectionData(sections.budget.content)
    ? sections.budget.content
    : undefined;

  if (!budgetContent && factsPresent && campaignFacts) {
    budgetContent = buildBudgetSectionDataFromFacts(campaignFacts, contextText);
  } else if (!budgetContent && stringContent(sections.budget.content).trim()) {
    budgetContent = buildBudgetSectionData(stringContent(sections.budget.content), {});
  } else if (budgetContent && factsPresent && campaignFacts) {
    budgetContent = buildBudgetSectionDataFromFacts(campaignFacts, contextText);
  }

  let timelineContent = isTimelineSectionData(sections.timeline.content)
    ? sections.timeline.content
    : undefined;

  if (!timelineContent && factsPresent && campaignFacts) {
    timelineContent = buildTimelineSectionDataFromFacts(campaignFacts);
  }

  if (summaryText.trim() || audienceText.trim() || factsPresent) {
    const existingSummaryCards = sections.summary.data?.summaryCards as
      | SummarySectionData
      | undefined;
    sections.summary = {
      ...sections.summary,
      data: {
        ...sections.summary.data,
        summaryCards: buildSummarySectionData(
          summaryText,
          audienceText,
          campaignObject.meta.status,
          budgetContent,
          campaignFacts,
          { preservedEstimatedReach: existingSummaryCards?.estimatedReach }
        ),
      },
    };
  }

  if (strategyText.trim() || factsPresent) {
    const existingStrategyData = (sections.strategy.data ?? {}) as StrategySectionData;
    const existingPerformanceData = (sections.performance.data ?? {}) as PerformanceSectionData;
    const derivedStrategy = buildStrategySectionData(
      strategyText,
      audienceText,
      summaryText,
      hasApprovedCreatorMix(existingStrategyData) ? undefined : campaignFacts
    );
    const budgetText = budgetContent ? stringContent(sections.budget.content) : undefined;
    const enrichDurationWeeks = campaignFacts
      ? resolveFactsDurationWeeks(campaignFacts)
      : resolveCampaignDurationWeeks(summaryText, strategyText);
    const derivedWhyAi = deriveWhyAiInsights(
      strategyText,
      summaryText || contextText,
      budgetText,
      enrichDurationWeeks
    );

    sections.strategy = {
      ...sections.strategy,
      data: {
        ...existingStrategyData,
        groundedFields: hasApprovedExecutiveStrategy(existingStrategyData)
          ? existingStrategyData.groundedFields
          : derivedStrategy.groundedFields,
        creativeConcepts:
          existingStrategyData.creativeConcepts ?? derivedStrategy.creativeConcepts,
        creatorMix: hasApprovedCreatorMix(existingStrategyData)
          ? existingStrategyData.creatorMix
          : derivedStrategy.creatorMix,
        opportunities: existingStrategyData.opportunities ?? derivedStrategy.opportunities,
        whyAiInsights: hasApprovedDirectorMinutes(existingStrategyData)
          ? existingStrategyData.whyAiInsights
          : derivedWhyAi,
      },
    };

    if (!hasApprovedKpiReasoning(existingPerformanceData)) {
      sections.performance = {
        ...sections.performance,
        data: {
          ...existingPerformanceData,
          ...buildPerformanceSectionData(strategyText, audienceText, summaryText, campaignFacts),
        },
      };
    }
  }

  if (budgetContent) {
    const existingBudgetData = (sections.budget.data ?? {}) as BudgetSectionExtras;
    const budgetExtras = hasApprovedBudgetReasoning(existingBudgetData)
      ? {
          cpmAssumption: existingBudgetData.cpmAssumption,
          cpeAssumption: existingBudgetData.cpeAssumption,
          groundedAllocations: existingBudgetData.groundedAllocations,
          allocationReasoning: existingBudgetData.allocationReasoning,
          budgetPlannerReasoning: existingBudgetData.budgetPlannerReasoning,
        }
      : buildBudgetSectionExtras(budgetContent, contextText);

    sections.budget = {
      ...sections.budget,
      content: budgetContent,
      data: {
        ...existingBudgetData,
        ...budgetExtras,
      },
    };
  }

  if (timelineContent) {
    const existingTimelineData = (sections.timeline.data ?? {}) as TimelineSectionExtras;
    const durationWeeks = campaignFacts
      ? resolveFactsDurationWeeks(campaignFacts)
      : resolveCampaignDurationWeeks(summaryText, strategyText);
    const timelineComplete =
      campaignObject.meta.workflowStatus === "completed" ||
      campaignObject.meta.workflowStatus === "complete" ||
      campaignObject.meta.status === "complete" ||
      sections.timeline.status === "complete";
    const { goLiveWeek } = buildTimelineWeeksForCampaign(
      durationWeeks,
      detectIndustryFromBrief([summaryText, strategyText].filter(Boolean).join("\n")),
      timelineContent.milestones,
      { isComplete: timelineComplete }
    );
    const timelineExtras = hasApprovedActivationTimeline(existingTimelineData)
      ? {
          weekDetails: existingTimelineData.weekDetails,
          contentPlan:
            existingTimelineData.contentPlan ??
            deriveContentPlan(strategyText, summaryText, durationWeeks),
          creatorActivationTimeline: existingTimelineData.creatorActivationTimeline,
        }
      : buildTimelineSectionExtras(timelineContent, strategyText, summaryText, {
          isComplete: timelineComplete,
          campaignFacts,
        });

    sections.timeline = {
      ...sections.timeline,
      content: {
        ...timelineContent,
        durationWeeks,
        goLiveWeek,
        milestones: timelineContent.milestones.filter((milestone) => milestone.week <= durationWeeks),
      },
      data: {
        ...existingTimelineData,
        ...timelineExtras,
      },
    };
  }

  if (contextText.trim() && !hasDirectorOperationsRisks(sections.operations.content)) {
    sections.operations = {
      ...sections.operations,
      data: {
        ...sections.operations.data,
        ...buildOperationsSectionExtras(contextText),
      },
    };
  }

  const creatorsData = (sections.creators.data ?? {}) as CreatorsSectionData;
  const discoveryTotal = creatorsData.discovery?.total ?? 0;
  const isSearching = creatorsData.phase === "discovery" && sections.creators.status === "working";

  if (creatorsData.discovery || isSearching) {
    const existingCreatorsData = (sections.creators.data ?? {}) as CreatorsSectionData;
    sections.creators = {
      ...sections.creators,
      data: {
        ...existingCreatorsData,
        discoveryPipeline: hasApprovedVendorFunnel(existingCreatorsData)
          ? existingCreatorsData.vendorDiscoveryFunnel ?? existingCreatorsData.discoveryPipeline
          : factsPresent && campaignFacts
            ? buildIs1ReasoningBundle(
                campaignFacts,
                resolveStrategyDocumentForFacts({ ...campaignObject, sections }, campaignFacts),
                { briefText: contextText, finalCandidateCount: discoveryTotal, isSearching }
              ).vendorDiscoveryFunnel
            : buildCreatorDiscoveryPipeline(discoveryTotal, isSearching),
      },
    };
  }

  if (factsPresent && campaignFacts) {
    const strategyDoc = resolveStrategyDocumentForFacts({ ...campaignObject, sections }, campaignFacts);
    applyIs1ReasoningToSections(
      sections,
      campaignFacts,
      strategyDoc,
      contextText,
      (sections.creators.data ?? {}) as CreatorsSectionData
    );
  }

  if (
    strategyText.trim() ||
    sections.presentation.status === "complete" ||
    typeof sections.presentation.content === "object"
  ) {
    sections.presentation = {
      ...sections.presentation,
      data: {
        ...sections.presentation.data,
        ...buildPresentationSectionExtras(strategyText, audienceText, summaryText, {
          ...campaignObject,
          sections,
        }),
      },
    };
  }

  return {
    ...campaignObject,
    sections,
    updatedAt: new Date().toISOString(),
  };
}
