"use client";

import { cn } from "@/lib/utils";
import type { RecommendationNarrative } from "@/features/campaign-studio/services/eci/recommendation-narrative";
import { StudioDecisionImpactPanel } from "./studio-decision-impact-panel";

type StudioRecommendationNarrativeProps = {
  narrative: RecommendationNarrative;
  className?: string;
  /** Compact: steps only. Full: alternatives + trade-offs + impact panel. */
  variant?: "compact" | "full";
  showImpactPanel?: boolean;
  impactLimit?: number;
};

/**
 * Canonical decision narrative — same order on every Studio planning surface.
 * Recommendation → Why → Evidence → Business → Commercial → Risk → Alternative → Decision Impact → Confidence
 */
export function StudioRecommendationNarrative({
  narrative,
  className,
  variant = "full",
  showImpactPanel = true,
  impactLimit,
}: StudioRecommendationNarrativeProps) {
  return (
    <div className={cn("space-y-2 text-[11px] text-muted-foreground", className)}>
      <ol className="m-0 list-none space-y-1.5 p-0">
        {narrative.steps.map((step, index) => (
          <li key={step.key}>
            <span className="font-semibold text-foreground">
              {index + 1}. {step.label}:
            </span>{" "}
            {step.body}
          </li>
        ))}
      </ol>

      {variant === "full" ? (
        <div className="space-y-1.5 border-t border-border/50 pt-2">
          <p className="font-semibold text-foreground">Planning alternatives</p>
          <p>
            <span className="font-medium text-foreground">Recommended option:</span>{" "}
            {narrative.alternatives.recommendedOption}
          </p>
          <p>
            <span className="font-medium text-foreground">Why recommended:</span>{" "}
            {narrative.alternatives.whyRecommended}
          </p>
          {narrative.alternatives.alternatives.map((alt, i) => (
            <div key={`${alt.option}-${i}`}>
              <p>
                <span className="font-medium text-foreground">Alternative {i + 1}:</span>{" "}
                {alt.option}
              </p>
              <p>
                <span className="font-medium text-foreground">Why not selected:</span>{" "}
                {alt.whyNotSelected}
              </p>
            </div>
          ))}
          <p>
            <span className="font-medium text-foreground">Trade-offs:</span>{" "}
            {narrative.alternatives.tradeOffs}
          </p>
        </div>
      ) : null}

      {showImpactPanel ? (
        <StudioDecisionImpactPanel
          impact={narrative.decisionImpact}
          limit={impactLimit}
          className="border-t border-border/50 pt-2"
        />
      ) : null}
    </div>
  );
}
