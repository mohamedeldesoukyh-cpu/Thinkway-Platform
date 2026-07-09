"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { buildScoreExplanations } from "../services/score-explainability";
import type { CampaignDecisionContext } from "@/features/campaign-decision-engine";
import type { ThinkwayScoreBreakdown } from "@/features/campaign-decision-engine";

type ScoreBreakdownProps = {
  baseline: CampaignDecisionContext;
  score: ThinkwayScoreBreakdown;
  scenarioName: string;
  className?: string;
};

export function ScoreBreakdown({
  baseline,
  score,
  scenarioName,
  className,
}: ScoreBreakdownProps) {
  const [expanded, setExpanded] = useState(false);
  const explanations = buildScoreExplanations(baseline, score, scenarioName);

  return (
    <Card size="sm" className={cn("rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div>
            <CardTitle className="text-sm font-semibold">
              Thinkway Score{" "}
              <span className="text-[#1D9E75]">{score.total}</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Click to expand breakdown</p>
          </div>
          {expanded ? (
            <ChevronUpIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {explanations.map((metric) => (
            <div
              key={metric.key}
              className="rounded-xl border border-border/50 bg-background p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {metric.label}{" "}
                  <span className="text-muted-foreground">
                    ({Math.round((metric.score * metric.maxScore) / 100)}/{metric.maxScore})
                  </span>
                </span>
                <span className="text-xs tabular-nums text-[#1D9E75]">{metric.score}/100</span>
              </div>
              <p className="mt-1 text-[11px] text-foreground/80">{metric.why}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Evidence: {metric.evidence}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Confidence: {metric.confidence}%
              </p>
              {metric.improvements.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                  {metric.improvements.map((tip) => (
                    <li key={tip}>→ {tip}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
