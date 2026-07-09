"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import { GroundingBadge } from "./shared/grounding-badge";
import { formatCurrency } from "./shared/format-utils";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { DASHBOARD_BUDGET_TOP } from "../../constants/studio-layout";
import { resolveBudgetData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS = [
  "bg-[#1D9E75]",
  "bg-violet-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-slate-400",
];

type BudgetPlannerSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

function PieChart({ percents }: { percents: number[] }) {
  const colors = ["#1D9E75", "#8b5cf6", "#6366f1", "#f59e0b", "#94a3b8"];
  let cumulative = 0;
  const gradientStops = percents
    .map((percent, i) => {
      const start = cumulative;
      cumulative += percent;
      return `${colors[i % colors.length]} ${start}% ${cumulative}%`;
    })
    .join(", ");

  return (
    <div
      className="mx-auto size-24 rounded-full"
      style={{ background: `conic-gradient(${gradientStops})` }}
    />
  );
}

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
  const maxAmount = Math.max(...budget.allocations.map((a) => a.amount ?? 0), 1);
  const percents = budget.allocations.map((a) => a.percent ?? (total ? Math.round(((a.amount ?? 0) / total) * 100) : 0));
  const grounded = budget.groundedAllocations ?? [];

  return (
    <div className="min-w-0 w-full space-y-4">
      {total > 0 ? (
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <p className="break-words text-lg font-bold text-foreground">{formatCurrency(total, budget.currency)}</p>
          <span className="shrink-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {budget.currency}
          </span>
        </div>
      ) : null}

      <div className={DASHBOARD_BUDGET_TOP}>
        <div className="flex w-full justify-center lg:justify-start">
          <PieChart percents={percents} />
        </div>
        <div className="min-w-0 w-full space-y-2">
          {budget.allocations.map((line, index) => {
            const g = grounded[index];
            return (
              <div key={line.category} className="min-w-0 overflow-hidden rounded-lg border border-border/40 bg-muted/10 px-2 py-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px]">
                  <span className={cn("size-2.5 shrink-0 rounded-full", CATEGORY_COLORS[index % CATEGORY_COLORS.length])} />
                  <span className="min-w-0 flex-1 break-words font-medium">{line.category}</span>
                  <span className="text-muted-foreground">{line.percent ?? percents[index]}%</span>
                  {line.amount ? (
                    <span className="font-semibold">{formatCurrency(line.amount, budget.currency)}</span>
                  ) : null}
                </div>
                {g ? (
                  <div className="mt-1 flex flex-wrap items-start gap-1.5">
                    <GroundingBadge source={g.source} confidence={g.confidence} />
                    <p className="min-w-0 break-words text-[10px] text-muted-foreground">{g.reason}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {(budget.budgetPlannerReasoning || budget.cpmAssumption || budget.cpeAssumption) && (
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {budget.budgetPlannerReasoning ? (
            <div className="col-span-full rounded-lg border border-[#1D9E75]/30 bg-[#1D9E75]/5 p-2.5 text-[11px]">
              <span className="font-semibold text-[#1D9E75]">Director rationale: </span>
              <span className="text-muted-foreground">{budget.budgetPlannerReasoning}</span>
            </div>
          ) : null}
          {budget.cpmAssumption ? (
            <div className="flex justify-between rounded-lg border border-border/60 bg-muted/10 p-2.5 text-[11px]">
              <span className="text-muted-foreground">CPM assumption</span>
              <span className="font-medium">{budget.cpmAssumption}</span>
            </div>
          ) : null}
          {budget.cpeAssumption ? (
            <div className="flex justify-between rounded-lg border border-border/60 bg-muted/10 p-2.5 text-[11px]">
              <span className="text-muted-foreground">CPE assumption</span>
              <span className="font-medium">{budget.cpeAssumption}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
