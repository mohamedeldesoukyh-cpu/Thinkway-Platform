"use client";

import { cn } from "@/lib/utils";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import { studioClientDecision } from "@/features/campaign-studio/services/studio-creator-client-decision";
import type { StudioCreatorGroupKind } from "@/features/campaign-studio/services/studio-replacement-candidates";

type StudioPlanningIntelligenceStripProps = {
  signal?: StudioEciPlanningSignal | null;
  className?: string;
  /**
   * Which group this card is in. The decision line is stated in that group's
   * vocabulary, so a heading and a card can never contradict each other.
   */
  group?: StudioCreatorGroupKind;
  /** Requirement rows met / total, when the card has them. */
  requirementsMet?: { met: number; total: number } | null;
};

/**
 * Compact executive cue on creator cards — decision first, not score-first.
 * Expanded state uses the canonical recommendation narrative (same order everywhere).
 */
export function StudioPlanningIntelligenceStrip({
  signal,
  className,
  group = "selected",
  requirementsMet = null,
}: StudioPlanningIntelligenceStripProps) {
  // A creator with no intelligence yet says nothing extra on the recommended
  // list — the group heading already states the recommendation. In the other
  // groups the decision line is the only thing distinguishing a slate member
  // held for review from a Discovery alternative, so it is stated from the
  // group alone.
  if (!signal && group === "selected") return null;

  // Client-facing decision and reasons. The internal reasoning behind them is
  // unchanged and still available in the creator detail's Campaign tab; it is
  // simply not printed on the card.
  const client = studioClientDecision({ group, signal, requirementsMet });

  return (
    <div className={cn("mt-2 space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-extrabold",
            client.tone === "positive"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : client.tone === "negative"
                ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200"
                : "bg-muted text-muted-foreground"
          )}
        >
          {client.label}
        </span>
      </div>

      <ul className="m-0 list-none space-y-0.5 p-0 text-[11px] text-muted-foreground">
        {client.reasons.map((reason) => (
          <li key={reason} className="leading-snug">
            {reason}
          </li>
        ))}
      </ul>

      {/*
        The full decision narrative — evidence, alternatives, decision impact —
        stays in the creator detail's Campaign tab. It is analyst-facing
        reasoning and was being expanded inline on the client-facing card.
      */}
    </div>
  );
}
