"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import { formatCurrency } from "./shared/format-utils";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { BudgetHero, BudgetRow } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveBudgetData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type BudgetPlannerSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function BudgetPlannerSection({
  campaignObject,
  fallbackText,
  status,
}: BudgetPlannerSectionProps) {
  const isRunning = status === "running";
  const budget = resolveBudgetData(campaignObject);

  if (isRunning && !budget) {
    return <SectionSkeleton variant="chart" />;
  }

  if (!budget || budget.allocations.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Budget allocation pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  const total =
    budget.total ??
    budget.allocations.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const percents = budget.allocations.map(
    (a) => a.percent ?? (total ? Math.round(((a.amount ?? 0) / total) * 100) : 0)
  );
  const grounded = budget.groundedAllocations ?? [];

  return (
    <div className="min-w-0 w-full">
      {total > 0 ? (
        <BudgetHero
          amount={formatCurrency(total, budget.currency)}
          caption="Total campaign budget"
        />
      ) : null}

      {budget.allocations.map((line, index) => {
        const g = grounded[index];
        return (
          <BudgetRow
            key={line.category}
            name={line.category}
            amount={`${line.percent ?? percents[index]}% · ${line.amount ? formatCurrency(line.amount, budget.currency) : "—"}`}
            trailing={
              g?.confidence != null ? (
                <span className={STUDIO_CLASSES.pillAi}>AI {g.confidence}%</span>
              ) : null
            }
          />
        );
      })}

      {budget.budgetPlannerReasoning ? (
        <div className={STUDIO_CLASSES.rationaleBox}>
          <b>Director rationale:</b> {budget.budgetPlannerReasoning}
        </div>
      ) : null}
    </div>
  );
}
