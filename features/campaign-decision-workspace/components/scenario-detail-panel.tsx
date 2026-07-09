"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { MetricComparison } from "../types";

type ScenarioDetailPanelProps = {
  scenarioName: string;
  metrics: MetricComparison[];
  className?: string;
};

function formatValue(metric: MetricComparison): string {
  switch (metric.format) {
    case "currency":
      return `${metric.value.toLocaleString()} ${metric.currency ?? ""}`.trim();
    case "percent":
      return `${metric.value.toFixed(1)}%`;
    case "score":
      return String(Math.round(metric.value));
    default:
      return metric.value >= 1_000_000
        ? `${(metric.value / 1_000_000).toFixed(1)}M`
        : metric.value >= 1_000
          ? `${(metric.value / 1_000).toFixed(0)}K`
          : metric.value.toLocaleString();
  }
}

export function ScenarioDetailPanel({
  scenarioName,
  metrics,
  className,
}: ScenarioDetailPanelProps) {
  return (
    <Card size="sm" className={cn("h-full rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{scenarioName}</CardTitle>
        <p className="text-xs text-muted-foreground">Compared vs Original</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-border/50 bg-background p-2.5"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatValue(metric)}</p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] font-medium tabular-nums",
                  metric.percentChange > 0 && "text-[#1D9E75]",
                  metric.percentChange < 0 && "text-destructive",
                  metric.percentChange === 0 && "text-muted-foreground"
                )}
              >
                {metric.percentChange > 0 ? "+" : ""}
                {metric.percentChange}%
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
