"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import { toExecutiveCreatorCardView } from "@/features/campaign-studio/services/eci/executive-planning-view";
import { StudioRecommendationNarrative } from "./studio-recommendation-narrative";

type StudioPlanningIntelligenceStripProps = {
  signal?: StudioEciPlanningSignal | null;
  className?: string;
  compact?: boolean;
  /** Optional display name for recommendation wording. */
  displayName?: string;
};

/**
 * Compact executive cue on creator cards — decision first, not score-first.
 * Expanded state uses the canonical recommendation narrative (same order everywhere).
 */
export function StudioPlanningIntelligenceStrip({
  signal,
  className,
  compact = true,
  displayName,
}: StudioPlanningIntelligenceStripProps) {
  const [expanded, setExpanded] = useState(false);
  if (!signal) return null;

  const view = toExecutiveCreatorCardView(signal, displayName);
  const recommended = view.decision === "Recommended";

  return (
    <div className={cn("mt-2 space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-extrabold",
            recommended
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200"
          )}
        >
          {view.decision}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
          {view.strategyConfidence.level} confidence
        </span>
      </div>

      <ul className="m-0 list-none space-y-0.5 p-0 text-[11px] text-muted-foreground">
        {view.bullets.slice(0, 4).map((bullet) => (
          <li key={bullet} className="leading-snug">
            {bullet}
          </li>
        ))}
      </ul>

      {!compact || expanded ? (
        <StudioRecommendationNarrative
          narrative={view.narrative}
          variant="full"
          impactLimit={3}
          className="border-t border-border/50 pt-1.5"
        />
      ) : (
        <button
          type="button"
          className="text-[10px] font-semibold text-[#0057FF] hover:underline"
          onClick={() => setExpanded(true)}
        >
          Evidence, alternatives & decision impact
        </button>
      )}

      {expanded && compact ? (
        <button
          type="button"
          className="text-[10px] font-semibold text-muted-foreground hover:underline"
          onClick={() => setExpanded(false)}
        >
          Hide details
        </button>
      ) : null}
    </div>
  );
}
