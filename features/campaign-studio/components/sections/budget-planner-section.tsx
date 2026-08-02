"use client";

import { useMemo } from "react";

import { SectionSkeleton } from "./shared/section-skeleton";
import { formatCurrency } from "./shared/format-utils";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { BudgetHero, BudgetRow, RationaleBar } from "./shared/studio-ui-primitives";
import { resolveBudgetData } from "../../services/section-data-resolver";
import { deriveEnterprisePlanningNarrative } from "../../services/planning-narrative";
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
  const narrative = useMemo(
    () => (campaignObject ? deriveEnterprisePlanningNarrative(campaignObject) : null),
    [campaignObject]
  );

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

  return (
    <div className="min-w-0 w-full space-y-2.5">
      {narrative ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-[12px] text-foreground">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Commercial strategy
          </p>
          <p className="mt-1">
            <b>What we should do:</b> {narrative.commercialStrategy}
          </p>
          <p className="mt-1 text-muted-foreground">
            <b className="text-foreground">Allocation logic:</b>{" "}
            {narrative.budgetNarrative.allocationLogic}
          </p>
          <p className="mt-1 text-muted-foreground">
            <b className="text-foreground">Commercial impact:</b>{" "}
            {narrative.budgetNarrative.commercialImpact}
          </p>
          <p className="mt-1 text-muted-foreground">
            <b className="text-foreground">Trade-offs:</b>{" "}
            {narrative.budgetNarrative.tradeOffs}
          </p>
        </div>
      ) : null}

      {total > 0 ? (
        <BudgetHero
          amount={formatCurrency(total, budget.currency)}
          caption="Total campaign budget"
        />
      ) : null}

      {budget.allocations.map((line, index) => (
        <BudgetRow
          key={line.category}
          name={line.category}
          amount={`${line.percent ?? percents[index]}% · ${line.amount ? formatCurrency(line.amount, budget.currency) : "—"}`}
        />
      ))}

      {budget.budgetPlannerReasoning ? (
        <RationaleBar>
          <b>Commercial rationale:</b> {budget.budgetPlannerReasoning}
        </RationaleBar>
      ) : null}
    </div>
  );
}
