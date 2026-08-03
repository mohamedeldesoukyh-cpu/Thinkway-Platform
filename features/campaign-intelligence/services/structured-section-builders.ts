import {
  formatRankedResults,
  formatSearchResults,
  assignDiscoveryOrderRanks,
  assignCampaignRelevanceRanks,
  hasCampaignRelevanceScores,
  formatShortlistSuggestion,
  formatShortlistSuggestionMarkdown,
  normalizeCreators,
  type GroundedCreator,
} from "@/features/ai-workflows/formatters/creator-formatter";
import { sanitizeTimelineText } from "@/features/campaign-studio/components/sections/shared/format-utils";
import {
  isInternalTimelinePhase,
  sanitizeToClientTimeline,
} from "@/features/campaign-director/services/timeline-rules";
import type { WorkflowTaskResult } from "@/features/ai-workflows/types";

import type {
  BudgetSectionData,
  CreatorDiscoverySectionData,
  CreatorRecommendationSectionData,
  KpiForecastSectionData,
  PresentationStatusSectionData,
  RiskAnalysisSectionData,
  TimelineSectionData,
} from "../types/section-schemas";
import {
  deriveInfluencerBudgetAllocations,
  normalizeBudgetAllocationPercents,
  resolveBudgetAllocations,
} from "@/features/campaign-studio/services/budget-allocation";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import { buildBudgetSectionDataFromFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { buildVendorRecommendationReasoning } from "@/features/campaign-intelligence/services/reasoning/vendor-recommendation-reasoning";
import { buildKpiForecastReasoning } from "@/features/campaign-intelligence/services/reasoning/kpi-reasoning";

const CURRENCY_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\bEGP\b/i, code: "EGP" },
  { pattern: /\bAED\b/i, code: "AED" },
  { pattern: /\bEUR\b|€/i, code: "EUR" },
  { pattern: /\bGBP\b|£/i, code: "GBP" },
  { pattern: /\bSAR\b/i, code: "SAR" },
  { pattern: /\bUSD\b|\$/i, code: "USD" },
];

export function detectCurrencyFromText(...sources: Array<string | undefined>): string {
  for (const source of sources) {
    if (!source?.trim()) continue;
    for (const { pattern, code } of CURRENCY_PATTERNS) {
      if (pattern.test(source)) return code;
    }
  }
  return "USD";
}

export function parseBudgetAmount(text: string): number | undefined {
  const match = text.match(
    /(?:total|budget)[:\s]*(?:[\w]{3}\s*)?([\d,]+(?:\.\d+)?)\s*(?:k|m)?/i
  );
  if (!match?.[1]) return undefined;
  let value = parseFloat(match[1].replace(/,/g, ""));
  if (/k\b/i.test(text)) value *= 1_000;
  if (/m\b/i.test(text)) value *= 1_000_000;
  return Number.isFinite(value) ? value : undefined;
}

export function buildBudgetSectionData(
  content: string,
  stateData: Record<string, unknown>,
  campaignFacts?: CampaignFacts
): BudgetSectionData {
  const facts = campaignFacts ?? (stateData.campaignFacts as CampaignFacts | undefined);

  if (facts?.budget) {
    const userMessage =
      typeof stateData.userMessage === "string" ? stateData.userMessage : content;
    return buildBudgetSectionDataFromFacts(facts, userMessage);
  }

  const currency =
    typeof stateData.currency === "string"
      ? stateData.currency
      : detectCurrencyFromText(
          content,
          typeof stateData.userMessage === "string" ? stateData.userMessage : undefined
        );

  const total =
    typeof stateData.budgetTotal === "number"
      ? stateData.budgetTotal
      : parseBudgetAmount(content);

  const allocations: BudgetSectionData["allocations"] = [];
  const categoryPatterns: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /creator\s*fees?|vendor\s*fees?/i, category: "Creator fees" },
    { pattern: /content\s*production|production/i, category: "Content production" },
    { pattern: /usage\s*rights?/i, category: "Usage rights" },
    { pattern: /(?:paid\s*)?amplification|media/i, category: "Paid amplification" },
    { pattern: /contingency/i, category: "Contingency reserve" },
    { pattern: /management|agency/i, category: "Agency coordination" },
  ];

  for (const { pattern, category } of categoryPatterns) {
    const line = content.split("\n").find((l) => pattern.test(l));
    if (!line) continue;
    if (
      /\b(?:no|without|exclude(?:d)?|not\s+(?:requiring|including))\s/i.test(line) &&
      /production|usage\s*rights?|amplification|agency|studio|boosting/i.test(line)
    ) {
      continue;
    }
    const amountMatch = line.match(/([\d,]+(?:\.\d+)?)\s*(?:k|m)?/i);
    let amount: number | undefined;
    if (amountMatch?.[1]) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      if (/k\b/i.test(line)) amount *= 1_000;
      if (/m\b/i.test(line)) amount *= 1_000_000;
    }
    const percentMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
    allocations.push({
      category,
      amount: Number.isFinite(amount) ? amount : undefined,
      percent: percentMatch?.[1] ? parseFloat(percentMatch[1]) : undefined,
    });
  }

  if (allocations.length === 0 && total) {
    const industry = detectIndustryFromBrief(content);
    allocations.push(
      ...deriveInfluencerBudgetAllocations(industry, content, total)
    );
  } else if (allocations.length > 0) {
    const resolved = resolveBudgetAllocations(allocations, content, total);
    allocations.length = 0;
    allocations.push(...resolved);
  }

  const contingencyLine = allocations.find((a) => /contingency/i.test(a.category));

  return {
    currency,
    total,
    allocations,
    contingencyPercent: contingencyLine?.percent,
    notes: content.trim() || undefined,
  };
}

export function buildTimelineSectionData(content: string): TimelineSectionData {
  const clientContent = sanitizeToClientTimeline(content);
  const milestones: TimelineSectionData["milestones"] = [];
  const weekLines = clientContent.split("\n").filter((line) => /week\s*\d/i.test(line));

  for (const line of weekLines) {
    const weekMatch = line.match(/week\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
    if (!weekMatch?.[1]) continue;
    const week = parseInt(weekMatch[1], 10);
    const rawPhase = line
      .replace(/^[-*•\s]+/, "")
      .replace(/week\s*\d+(?:\s*[-–]\s*\d+)?[:\s]*/i, "")
      .trim();
    const phase = sanitizeTimelineText(rawPhase.split(/[—–-]/)[0] ?? rawPhase);
    if (isInternalTimelinePhase(phase)) continue;
    const activities = rawPhase
      .split(/[,;]/)
      .map((a) => sanitizeTimelineText(a.trim()))
      .filter(Boolean);

    milestones.push({
      week,
      phase: activities[0] ?? phase,
      activities: activities.length > 0 ? activities : phase ? [phase] : [],
      status: "pending",
    });
  }

  if (milestones.length === 0) {
    const defaultPhases = [
      { week: 1, phase: "Campaign Start", activities: ["Campaign kickoff", "Creator briefing"] },
      { week: 2, phase: "Content Production", activities: ["Creator content creation", "Brand review cycles"] },
      { week: 3, phase: "Publishing Window", activities: ["Scheduled publishing", "Real-time monitoring"] },
      { week: 4, phase: "Reporting", activities: ["Performance analysis", "Final report delivery"] },
    ];
    milestones.push(...defaultPhases.map((m) => ({ ...m, status: "pending" as const })));
  }

  const durationHint = content.match(/(\d+)\s*weeks?/i);
  const durationWeeks = durationHint?.[1]
    ? parseInt(durationHint[1], 10)
    : milestones.length === 0
      ? 4
      : undefined;

  return {
    durationWeeks: durationWeeks && durationWeeks > 0 ? durationWeeks : undefined,
    milestones,
    goLiveWeek: undefined,
  };
}

export function buildKpiForecastFromStrategy(
  strategyContent: string,
  facts?: CampaignFacts,
  strategy?: CampaignStrategyDocument
): KpiForecastSectionData {
  if (facts && strategy) {
    const reasoning = buildKpiForecastReasoning(facts, strategy);
    return {
      kpis: reasoning.kpis.map((k) => ({
        metric: k.metric,
        target: k.target,
        benchmark: k.dependencies.join("; "),
      })),
      forecastNotes: reasoning.forecastNotes,
    };
  }

  const kpis: KpiForecastSectionData["kpis"] = [];
  const lines = strategyContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^[-*•]/.test(trimmed)) continue;
    const kpiMatch = trimmed.match(
      /^[-*•]\s*(.+?):\s*([\d,.]+\s*(?:%|M|K|k|m)?(?:\s+\w+)?)/i
    );
    if (kpiMatch) {
      kpis.push({ metric: kpiMatch[1].trim(), target: kpiMatch[2].trim() });
      continue;
    }
    if (/reach|engagement|impression|conversion|roi|ctr|view|cpm|cpa/i.test(trimmed)) {
      const parts = trimmed.replace(/^[-*•]\s*/, "").split(/[—–:-]/);
      if (parts.length >= 2) {
        kpis.push({ metric: parts[0].trim(), target: parts.slice(1).join(" ").trim() });
      }
    }
  }

  if (kpis.length === 0 && strategyContent.trim()) {
    kpis.push(
      { metric: "Reach", target: "TBD — confirm with brand objectives" },
      { metric: "Engagement rate", target: "TBD — benchmark against category" }
    );
  }

  return { kpis, forecastNotes: "Forecasts based on campaign strategy objectives." };
}

export function buildRiskAnalysisFromBudget(
  budgetData: BudgetSectionData,
  strategyContent?: string
): RiskAnalysisSectionData {
  const risks: RiskAnalysisSectionData["risks"] = [];

  if (budgetData.contingencyPercent != null && budgetData.contingencyPercent < 8) {
    risks.push({
      risk: "Low contingency buffer may not cover vendor availability shifts",
      severity: "medium",
      mitigation: "Increase contingency to 10–15% or maintain backup shortlist",
      category: "budget",
    });
  }

  const strategyLines = (strategyContent ?? "").split("\n");
  for (const line of strategyLines) {
    if (!/risk|challenge|constraint|caution/i.test(line)) continue;
    const text = line.replace(/^[-*•#\s]+/, "").trim();
    if (text.length > 10) {
      risks.push({
        risk: text,
        severity: /critical|high|major/i.test(text) ? "high" : "medium",
        category: "strategy",
      });
    }
  }

  if (risks.length === 0) {
    risks.push({
      risk: "Vendor response rates may vary during outreach",
      severity: "medium",
      mitigation: "Maintain ranked backup vendors from discovery results",
      category: "operations",
    });
  }

  const highCount = risks.filter((r) => r.severity === "high").length;
  const overallRiskLevel: RiskAnalysisSectionData["overallRiskLevel"] =
    highCount >= 2 ? "high" : highCount >= 1 ? "medium" : "low";

  return { risks, overallRiskLevel };
}

export function buildPresentationStatus(
  content: string,
  stateData: Record<string, unknown>,
  status: PresentationStatusSectionData["status"] = "awaiting_approval"
): PresentationStatusSectionData {
  const draft = stateData.campaignDraft as
    | { draft?: { name?: string; suggestedLines?: unknown[] } }
    | undefined;
  const campaignName =
    draft?.draft?.name ??
    (typeof stateData.brandName === "string" ? `${stateData.brandName} Campaign` : undefined);

  return {
    status,
    campaignName,
    brandName: typeof stateData.brandName === "string" ? stateData.brandName : undefined,
    lineCount: Array.isArray(draft?.draft?.suggestedLines)
      ? draft.draft.suggestedLines.length
      : undefined,
    message: content.trim() || "Campaign draft prepared for approval.",
    nextStep: "Review and approve the campaign action card to create the campaign header and lines.",
  };
}

export function extractCreatorsFromTaskResult(
  result: WorkflowTaskResult,
  stateData: Record<string, unknown>
): GroundedCreator[] {
  const rankTaskIds = new Set(["rank-results", "curate-selection", "build-shortlist"]);

  if (rankTaskIds.has(result.taskId) && Array.isArray(stateData.searchResults)) {
    const fromSearch = normalizeCreators(stateData.searchResults, "rankingInput");
    if (fromSearch.length > 0) return fromSearch;
  }

  const structured = result.structured;
  if (structured) {
    if (Array.isArray(structured.creators)) {
      const normalized = normalizeCreators(structured.creators);
      if (normalized.length > 0) return normalized;
    }

    const outputs = structured.toolOutputs as
      | Array<{ tool: string; output: unknown }>
      | undefined;
    if (outputs?.length) {
      for (const entry of outputs) {
        if (entry.tool === "searchCreators" && entry.output) {
          const search = entry.output as { creators?: unknown[] };
          const normalized = normalizeCreators(search.creators);
          if (normalized.length > 0) return normalized;
        }
      }
    }
  }

  if (Array.isArray(stateData.searchResults)) {
    return normalizeCreators(stateData.searchResults);
  }

  return [];
}

export function buildCreatorDiscoveryData(
  creators: GroundedCreator[],
  total: number,
  query?: string,
  facts?: CampaignFacts,
  strategy?: CampaignStrategyDocument
): CreatorDiscoverySectionData {
  const deduped = normalizeCreators(creators, "campaignObjectDiscovery");
  return {
    creatorIds: deduped.map((c) => c.id),
    total,
    query,
  };
}

export function buildCreatorRecommendationData(
  creators: GroundedCreator[],
  query?: string,
  facts?: CampaignFacts,
  strategy?: CampaignStrategyDocument,
  poolCreators?: GroundedCreator[]
): CreatorRecommendationSectionData {
  const deduped = normalizeCreators(creators, "campaignObjectRecommendations");
  const ranked = hasCampaignRelevanceScores(deduped)
    ? assignCampaignRelevanceRanks(deduped)
    : assignDiscoveryOrderRanks(deduped);
  const suggestion = formatShortlistSuggestion(ranked, query);
  const avgFitScore =
    ranked.length > 0
      ? Math.round(ranked.reduce((sum, c) => sum + c.fitScore, 0) / ranked.length)
      : undefined;

  // Facts alone are enough for why-selected — strategy may not be on the
  // CampaignObject yet when CIP proposes the first slate.
  const reasoning = facts
    ? buildVendorRecommendationReasoning(
        facts,
        strategy,
        ranked,
        poolCreators ?? []
      )
    : null;

  return {
    creatorIds: suggestion.creatorIds,
    rationale: suggestion.rationale,
    avgFitScore,
    creatorFitScores: Object.fromEntries(ranked.map((c) => [c.id, c.fitScore])),
    selectedReasoning: reasoning?.selected,
    rejectedReasoning: reasoning?.rejected,
  };
}

export function formatDiscoveryDisplay(
  creators: GroundedCreator[],
  total: number,
  query?: string
): string {
  return formatSearchResults(creators, total, query);
}

export function formatRecommendationDisplay(
  creators: GroundedCreator[],
  query?: string
): string {
  if (creators.length === 0) {
    return "_No vendors available to recommend — run discovery search first._";
  }
  const ranked = hasCampaignRelevanceScores(creators)
    ? assignCampaignRelevanceRanks(creators)
    : assignDiscoveryOrderRanks(creators);
  return formatRankedResults(ranked, query);
}

export function formatShortlistDisplay(
  creators: GroundedCreator[],
  query?: string
): string {
  const ranked = hasCampaignRelevanceScores(creators)
    ? assignCampaignRelevanceRanks(creators)
    : assignDiscoveryOrderRanks(creators);
  return formatShortlistSuggestionMarkdown(formatShortlistSuggestion(ranked, query));
}
