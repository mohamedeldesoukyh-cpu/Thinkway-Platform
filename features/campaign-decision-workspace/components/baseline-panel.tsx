"use client";

import { ShieldAlertIcon, TrendingUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { UseDecisionWorkspaceReturn } from "../hooks/use-decision-workspace";

type BaselinePanelProps = {
  workspace: Pick<
    UseDecisionWorkspaceReturn,
    "baseline" | "baselineScenario"
  >;
  className?: string;
};

function formatCurrency(value: number, currency: string): string {
  return `${value.toLocaleString()} ${currency}`;
}

function formatReach(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

export function BaselinePanel({ workspace, className }: BaselinePanelProps) {
  const { baseline, baselineScenario } = workspace;
  const score = baselineScenario?.thinkwayScore.total ?? 0;

  return (
    <Card size="sm" className={cn("h-full rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Current Campaign</CardTitle>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Baseline
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Approved metrics — unchanged in sandbox
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Thinkway Score"
            value={String(score)}
            accent
          />
          <MetricTile
            label="Success Probability"
            value={`${baseline.successProbability}%`}
          />
          <MetricTile
            label="Budget"
            value={formatCurrency(baseline.budget.total, baseline.currency)}
          />
          <MetricTile
            label="Creator Count"
            value={String(baseline.kpis.creatorCount)}
          />
          <MetricTile
            label="Estimated Reach"
            value={formatReach(baseline.kpis.reach)}
          />
          <MetricTile
            label="Engagement"
            value={formatReach(baseline.kpis.engagement)}
          />
          <MetricTile
            label="Timeline"
            value={`${baseline.timeline.durationWeeks} wks`}
          />
          <MetricTile
            label="ER"
            value={`${baseline.kpis.engagementRate.toFixed(1)}%`}
          />
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldAlertIcon className="size-3.5" />
            Risks
          </div>
          {baseline.risk.factors.length > 0 ? (
            <ul className="space-y-1 text-xs text-foreground/80">
              {baseline.risk.factors.map((factor) => (
                <li key={factor} className="flex gap-1.5">
                  <span className="text-[#1D9E75]">•</span>
                  {factor}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No significant risks flagged</p>
          )}
        </div>

        {baseline.brand && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUpIcon className="size-3.5 text-[#1D9E75]" />
            {baseline.brand}
            {baseline.objective ? ` · ${baseline.objective.slice(0, 40)}…` : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          accent && "text-[#1D9E75]"
        )}
      >
        {value}
      </p>
    </div>
  );
}
