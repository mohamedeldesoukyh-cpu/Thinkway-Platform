"use client";

import { cn } from "@/lib/utils";
import type { CampaignCreatorDecision } from "@/features/campaign-studio/services/studio-campaign-creator-decision";

type StudioPlanningIntelligenceStripProps = {
  /**
   * The campaign's decision for this creator — the single authority. The
   * heading, this pill, the Why and the Evidence all read this one object, so
   * they cannot disagree.
   */
  decision: CampaignCreatorDecision;
  className?: string;
};

/**
 * The creator card's campaign decision.
 *
 * It used to render the ECI investment verdict as the campaign's answer, which
 * is how a card inside the campaign recommendation area came to say "Campaign
 * recommendation: not recommended", with analyst reasoning beneath it. The
 * decision now comes from campaign requirements; investment intelligence
 * appears below it, labelled as support, and cannot change it.
 */
export function StudioPlanningIntelligenceStrip({
  decision,
  className,
}: StudioPlanningIntelligenceStripProps) {
  return (
    <div className={cn("mt-2 space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-extrabold",
            decision.status === "recommended"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : decision.status === "not_recommended"
                ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200"
                : "bg-muted text-muted-foreground"
          )}
        >
          {decision.label}
        </span>
      </div>

      <p className="text-[11px] leading-snug text-foreground">{decision.why}</p>

      {decision.evidence.length > 0 ? (
        <ul className="m-0 list-none space-y-0.5 p-0 text-[11px] text-muted-foreground">
          {decision.evidence.map((line) => (
            <li key={line} className="leading-snug">
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {decision.supporting.length > 0 ? (
        <div className="text-[10px] text-muted-foreground">
          {/*
            Labelled as support so it cannot be read as the decision. The full
            analyst narrative stays in the creator detail's Campaign tab.
          */}
          <p className="font-semibold uppercase tracking-wide">Supporting intelligence</p>
          <ul className="m-0 mt-0.5 list-none space-y-0.5 p-0">
            {decision.supporting.map((line) => (
              <li key={line} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
