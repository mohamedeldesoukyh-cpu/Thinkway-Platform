import type { BudgetSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import {
  detectIndustryFromBrief,
  getIndustryProfile,
  type CampaignIndustry,
} from "./industry-intelligence";

export type BudgetAllocationLine = BudgetSectionData["allocations"][number];

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Adjust largest line so rounded percents sum to exactly 100. */
function fixPercentRounding(lines: Array<BudgetAllocationLine & { percent: number }>): BudgetAllocationLine[] {
  if (lines.length === 0) return lines;

  const rounded = lines.map((line) => ({ ...line, percent: roundPercent(line.percent) }));
  const delta = 100 - rounded.reduce((sum, line) => sum + line.percent, 0);
  if (Math.abs(delta) < 0.01) return rounded;

  const adjustIndex = rounded.reduce(
    (best, line, index, all) =>
      line.percent > all[best].percent ? index : best,
    0
  );
  rounded[adjustIndex] = {
    ...rounded[adjustIndex],
    percent: roundPercent(rounded[adjustIndex].percent + delta),
  };
  return rounded;
}

function syncAmounts(
  lines: BudgetAllocationLine[],
  total?: number
): BudgetAllocationLine[] {
  if (!total || total <= 0) return lines;
  return lines.map((line) => ({
    ...line,
    amount:
      line.percent != null ? Math.round((total * line.percent) / 100) : line.amount,
  }));
}

/**
 * Ensures allocation percents always sum to exactly 100%.
 * Derives missing percents from amounts when possible, otherwise normalizes proportionally.
 */
export function normalizeBudgetAllocationPercents(
  allocations: BudgetAllocationLine[],
  total?: number
): BudgetAllocationLine[] {
  if (allocations.length === 0) return allocations;

  const withPercents = allocations.map((line) => {
    let percent = line.percent;
    if (percent == null && total && line.amount != null && total > 0) {
      percent = (line.amount / total) * 100;
    }
    return { ...line, percent: percent ?? 0 };
  });

  const sum = withPercents.reduce((acc, line) => acc + (line.percent ?? 0), 0);
  if (sum <= 0) return withPercents;

  let normalized = withPercents;
  if (Math.abs(sum - 100) > 0.01) {
    normalized = withPercents.map((line) => ({
      ...line,
      percent: ((line.percent ?? 0) / sum) * 100,
    }));
  }

  const fixed = fixPercentRounding(
    normalized.map((line) => ({ ...line, percent: line.percent ?? 0 }))
  );
  return syncAmounts(fixed, total);
}

export function sumAllocationPercents(allocations: BudgetAllocationLine[]): number {
  return roundPercent(allocations.reduce((sum, line) => sum + (line.percent ?? 0), 0));
}

/** BL-1 default: single line 100% Creator Fees when no split keywords present. */
export function buildSingleCreatorFeesAllocation(
  total?: number,
  notes?: string
): BudgetAllocationLine[] {
  return normalizeBudgetAllocationPercents(
    [
      {
        category: "Creator fees",
        percent: 100,
        amount: total,
        notes,
      },
    ],
    total
  );
}

/** Influencer-marketing budget categories derived from campaign industry profile. */
export function deriveInfluencerBudgetAllocations(
  industry: CampaignIndustry,
  contextText: string | undefined,
  total?: number
): BudgetAllocationLine[] {
  const profile = getIndustryProfile(industry, contextText);
  const lines = profile.budgetWeights.map((weight) => ({
    category: weight.category,
    percent: weight.percent,
    amount: total ? Math.round((total * weight.percent) / 100) : undefined,
  }));
  return normalizeBudgetAllocationPercents(lines, total);
}

export function resolveBudgetAllocations(
  parsed: BudgetAllocationLine[],
  contextText: string,
  total?: number
): BudgetAllocationLine[] {
  const industry = detectIndustryFromBrief(contextText);
  const hasExplicitPercents = parsed.some((line) => line.percent != null);
  const hasExplicitAmounts = parsed.some((line) => line.amount != null);

  if (parsed.length === 0) {
    return deriveInfluencerBudgetAllocations(industry, contextText, total);
  }

  if (!hasExplicitPercents && !hasExplicitAmounts) {
    return deriveInfluencerBudgetAllocations(industry, contextText, total);
  }

  const normalized = normalizeBudgetAllocationPercents(parsed, total);
  if (sumAllocationPercents(normalized) === 100) return normalized;

  return deriveInfluencerBudgetAllocations(industry, contextText, total);
}
