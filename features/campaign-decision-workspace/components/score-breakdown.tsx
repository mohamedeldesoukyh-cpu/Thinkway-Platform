"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STUDIO_CLASSES } from "@/features/campaign-studio/constants/studio-tokens";

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
  const panelId = "score-breakdown-panel";
  const explanations = buildScoreExplanations(baseline, score, scenarioName);

  return (
    <Card size="sm" className={cn(STUDIO_CLASSES.card, "rounded-2xl", className)}>
      <CardHeader className="pb-2">
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between text-left",
            STUDIO_CLASSES.focusRing
          )}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={panelId}
        >
          <div>
            <CardTitle className="text-sm font-semibold">
              Thinkway Score{" "}
              <span className="text-brand-product">{score.total}</span>
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
        <CardContent
          id={panelId}
          className="space-y-2 pt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
        >
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
                <span className="text-xs tabular-nums text-brand-product">{metric.score}/100</span>
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
