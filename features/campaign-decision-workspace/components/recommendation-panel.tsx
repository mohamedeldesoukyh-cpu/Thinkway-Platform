"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { StructuredRecommendation } from "@/features/campaign-decision-engine";

type RecommendationPanelProps = {
  recommendation: StructuredRecommendation | null;
  className?: string;
};

export function RecommendationPanel({
  recommendation,
  className,
}: RecommendationPanelProps) {
  if (!recommendation) {
    return (
      <Card size="sm" className={cn("rounded-2xl border-border/80 shadow-none", className)}>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          No recommendation available for this scenario
        </CardContent>
      </Card>
    );
  }

  const reachDelta = recommendation.impact.kpiDeltas?.find((d) => d.metric === "reach");
  const engagementDelta = recommendation.impact.kpiDeltas?.find(
    (d) => d.metric === "engagement"
  );

  return (
    <Card size="sm" className={cn("rounded-2xl border-[#1D9E75]/20 shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{recommendation.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Confidence {recommendation.confidence}% · {recommendation.priority} priority
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="text-foreground/90">{recommendation.reason}</p>

        <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
          <p className="font-medium text-muted-foreground">Expected impact</p>
          <p className="mt-1">{recommendation.impact.summary}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
            {reachDelta && (
              <span>
                Reach {reachDelta.percentChange > 0 ? "+" : ""}
                {reachDelta.percentChange}%
              </span>
            )}
            {engagementDelta && (
              <span>
                Engagement {engagementDelta.percentChange > 0 ? "+" : ""}
                {engagementDelta.percentChange}%
              </span>
            )}
            {recommendation.impact.scoreDelta != null && (
              <span>
                Score {recommendation.impact.scoreDelta >= 0 ? "+" : ""}
                {recommendation.impact.scoreDelta}
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="font-medium text-muted-foreground">Alternative</p>
          <p className="mt-1 font-medium">{recommendation.alternative.title}</p>
          <p className="mt-0.5 text-muted-foreground">{recommendation.alternative.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
