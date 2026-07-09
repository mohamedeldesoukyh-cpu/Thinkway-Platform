import {
  buildSingleCreatorFeesAllocation,
  deriveInfluencerBudgetAllocations,
  normalizeBudgetAllocationPercents,
  sumAllocationPercents,
} from "@/features/campaign-studio/services/budget-allocation";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import type { BudgetSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "../types";

/** Keywords that require budget split away from 100% creator fees. */
export const BUDGET_SPLIT_KEYWORD_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Production", pattern: /\bproduction\b/i },
  { label: "Studio", pattern: /\bstudio\b/i },
  { label: "Photography", pattern: /\bphotograph(?:y|er)\b/i },
  { label: "Videography", pattern: /\bvideograph(?:y|er)\b|\bvideo\s+production\b/i },
  { label: "Usage Rights", pattern: /\busage\s*rights?\b/i },
  { label: "Paid Media", pattern: /\bpaid\s*media\b|\bpaid\s*amplification\b/i },
  { label: "Boosting", pattern: /\bboosting\b|\bboost(?:ed|ing)?\s+(?:posts?|content)\b/i },
  { label: "Agency Services", pattern: /\bagency\s*services?\b|\bagency\s*fee\b|\bagency\s*coordination\b/i },
];

const EMBEDDED_PRODUCTION_PATTERN =
  /creator\s*fees?\s*include\s*production|production\s*(?:is\s*)?included\s*in\s*creator/i;

/** Brief-level signals that budget must stay 100% creator fees (no split lines). */
export const BUDGET_SPLIT_NEGATIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "Production",
    pattern:
      /\b(?:no|without|exclude(?:d)?|zero|not\s+(?:requiring|including))\s+(?:[^.\n]{0,120}\s+)?(?:content\s+)?production\b|\bproduction\s+(?:not\s+required|excluded|not\s+included|out\s+of\s+scope|not\s+needed)\b/i,
  },
  {
    label: "Studio",
    pattern:
      /\b(?:no|without|exclude(?:d)?|zero|not\s+(?:requiring|including))\s+(?:separate\s+|dedicated\s+)?studio\b|\bstudio\s+(?:not\s+required|excluded|not\s+included|out\s+of\s+scope)\b/i,
  },
  {
    label: "Photography",
    pattern:
      /\b(?:no|without|exclude(?:d)?|zero|not\s+(?:requiring|including))\s+(?:separate\s+|dedicated\s+)?photograph(?:y|er)\b/i,
  },
  {
    label: "Videography",
    pattern:
      /\b(?:no|without|exclude(?:d)?|zero|not\s+(?:requiring|including))\s+(?:separate\s+|dedicated\s+)?(?:video\s+production|videograph(?:y|er))\b/i,
  },
  {
    label: "Usage Rights",
    pattern:
      /\b(?:no|without|exclude(?:d)?|zero|not\s+(?:requiring|including))\s+(?:[^.\n]{0,120}\s+)?usage\s*rights?\b|\busage\s*rights?\s+(?:not\s+required|excluded|not\s+included|out\s+of\s+scope|not\s+needed)\b/i,
  },
  {
    label: "Paid Media",
    pattern:
      /\b(?:no|without|exclude(?:d)?|zero|not\s+(?:requiring|including))\s+(?:separate\s+|dedicated\s+)?(?:paid\s*media|paid\s*amplification|media\s+buying)\b/i,
  },
  {
    label: "Boosting",
    pattern:
      /\b(?:no|without|exclude(?:d)?|zero|not\s+(?:requiring|including))\s+(?:separate\s+|dedicated\s+)?boosting\b/i,
  },
  {
    label: "Agency Services",
    pattern:
      /\b(?:no|without|exclude(?:d)?|zero|not\s+(?:requiring|including))\s+(?:separate\s+|dedicated\s+)?(?:agency\s*services?|agency\s*fee|agency\s*coordination)\b/i,
  },
];

const INFLUENCER_ONLY_BUDGET_PATTERN =
  /\b(?:100\s*%|entire(?:ty)?\s+of\s+(?:the\s+)?budget)\s+(?:to|on|for)\s+creator\s*fees\b|\binfluencer[\s-]only\s+budget\b|\bcreator\s*fees?\s+only\b|\ball\s+funds?\s+(?:to|for)\s+creator\s*fees\b/i;

const NEGATION_BEFORE_KEYWORD =
  /\b(?:no|without|exclude(?:d)?|not\s+(?:requiring|including)|zero|avoid)\s+(?:(?:separate|dedicated|additional|external|extended|paid)\s+)*(?:content\s+)?$/i;

/** @deprecated Use detectBudgetSplitKeywords — kept for backward compatibility. */
export const OPTIONAL_BUDGET_CATEGORIES: RegExp[] = BUDGET_SPLIT_KEYWORD_PATTERNS.map(
  (entry) => entry.pattern
);

export type BudgetSplitKeywordMatch = {
  keyword: string;
  source: "brief" | "facts_constraint";
};

function collectBudgetSplitSources(
  briefText: string,
  campaignFacts?: CampaignFacts
): string[] {
  const sources: string[] = [];
  if (briefText.trim()) sources.push(briefText);
  for (const constraint of campaignFacts?.constraints ?? []) {
    if (constraint.trim()) sources.push(constraint);
  }
  return sources;
}

function hasAffirmativeSplitKeyword(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const before = text.slice(Math.max(0, start - 60), start);
    if (NEGATION_BEFORE_KEYWORD.test(before)) continue;

    const after = text.slice(start, start + match[0].length + 50);
    if (/\b(?:not|without)\s+(?:required|included|needed|applicable|in\s+scope)\b/i.test(after)) {
      continue;
    }

    return true;
  }

  return false;
}

function detectBudgetSplitExclusions(
  briefText: string,
  campaignFacts?: CampaignFacts
): Set<string> {
  const excluded = new Set<string>();

  for (const text of collectBudgetSplitSources(briefText, campaignFacts)) {
    for (const { label, pattern } of BUDGET_SPLIT_NEGATIVE_PATTERNS) {
      if (pattern.test(text)) excluded.add(label);
    }
    if (INFLUENCER_ONLY_BUDGET_PATTERN.test(text)) {
      for (const { label } of BUDGET_SPLIT_KEYWORD_PATTERNS) {
        excluded.add(label);
      }
    }
  }

  return excluded;
}

/** True when brief or CampaignFacts explicitly forbid split budget lines. */
export function briefForbidsBudgetSplit(
  briefText: string,
  campaignFacts?: CampaignFacts
): boolean {
  const exclusions = detectBudgetSplitExclusions(briefText, campaignFacts);
  return (
    exclusions.has("Production") ||
    exclusions.has("Usage Rights") ||
    INFLUENCER_ONLY_BUDGET_PATTERN.test(
      collectBudgetSplitSources(briefText, campaignFacts).join("\n")
    )
  );
}

/** Detect explicit split keywords in brief text or CampaignFacts constraints. */
export function detectBudgetSplitKeywords(
  briefText: string,
  campaignFacts?: CampaignFacts
): BudgetSplitKeywordMatch[] {
  const matches: BudgetSplitKeywordMatch[] = [];
  const seen = new Set<string>();
  const exclusions = detectBudgetSplitExclusions(briefText, campaignFacts);

  for (const text of collectBudgetSplitSources(briefText, campaignFacts)) {
    if (EMBEDDED_PRODUCTION_PATTERN.test(text)) continue;

    for (const { label, pattern } of BUDGET_SPLIT_KEYWORD_PATTERNS) {
      if (exclusions.has(label)) continue;
      if (hasAffirmativeSplitKeyword(text, pattern) && !seen.has(label)) {
        seen.add(label);
        matches.push({
          keyword: label,
          source: text === briefText ? "brief" : "facts_constraint",
        });
      }
    }
  }

  return matches;
}

export function briefRequiresOptionalCategories(
  briefText: string,
  campaignFacts?: CampaignFacts
): boolean {
  return detectBudgetSplitKeywords(briefText, campaignFacts).length > 0;
}

export function defaultCreatorFeesRationale(
  briefText: string,
  campaignFacts?: CampaignFacts,
  strategyRationale?: string
): string {
  if (strategyRationale?.trim()) {
    return `${strategyRationale.trim()} — influencer-only default: 100% creator fees include production; no split keywords detected in brief or CampaignFacts constraints.`;
  }

  const keywordsChecked = BUDGET_SPLIT_KEYWORD_PATTERNS.map((entry) => entry.label).join(", ");
  return (
    `100% Creator Fees — brief and CampaignFacts do not mention split categories (${keywordsChecked}). ` +
    "Influencer campaign model: production is embedded in creator fees unless explicitly separated."
  );
}

/**
 * Build influencer-marketing budget from Director strategy and campaign facts SSOT.
 * Default: creator fees include production. Optional lines only if facts/brief requires.
 */
export function buildDirectorBudgetFromStrategy(
  strategy: CampaignStrategyDocument,
  briefText: string,
  campaignFacts?: CampaignFacts
): BudgetSectionData {
  const industry = detectIndustryFromBrief(
    campaignFacts?.industry ?? strategy.narrative
  );
  const total = campaignFacts?.budget?.amount ?? strategy.understanding.budget?.amount;
  const currency =
    campaignFacts?.budget?.currency ?? strategy.understanding.budget?.currency ?? "USD";

  const splitKeywords = detectBudgetSplitKeywords(briefText, campaignFacts);
  let allocations = deriveInfluencerBudgetAllocations(industry, strategy.narrative, total);

  if (splitKeywords.length === 0) {
    allocations = buildSingleCreatorFeesAllocation(
      total,
      defaultCreatorFeesRationale(
        briefText,
        campaignFacts,
        strategy.understanding.budget?.rationale
      )
    );
  } else {
    allocations = normalizeBudgetAllocationPercents(allocations, total);
  }

  return {
    currency,
    total,
    allocations: allocations.map((line) => ({
      ...line,
      notes:
        line.notes ??
        `${line.category} — ${strategy.understanding.budget?.rationale ?? "Director-approved allocation"}; split triggered by: ${splitKeywords.map((k) => k.keyword).join(", ")}`,
    })),
    contingencyPercent: allocations.find((a) => /contingency/i.test(a.category))?.percent,
    notes: strategy.understanding.budget?.rationale,
  };
}

export function validateBudgetTotals100(allocations: BudgetSectionData["allocations"]): boolean {
  if (allocations.length === 0) return false;
  return Math.abs(sumAllocationPercents(allocations) - 100) < 0.01;
}
