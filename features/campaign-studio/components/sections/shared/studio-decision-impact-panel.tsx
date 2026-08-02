"use client";

import { cn } from "@/lib/utils";
import type { DecisionImpactBundle } from "@/features/campaign-studio/services/eci/decision-impact";

type StudioDecisionImpactPanelProps = {
  impact: DecisionImpactBundle;
  className?: string;
  /** Show only the first N change scenarios (cards stay light). */
  limit?: number;
};

/**
 * Decision Impact — planning explanation, not a forecast.
 */
export function StudioDecisionImpactPanel({
  impact,
  className,
  limit,
}: StudioDecisionImpactPanelProps) {
  const rows = limit ? impact.assessments.slice(0, limit) : impact.assessments;
  const sufficient = impact.assessments.some((a) => a.evidenceSufficient);

  return (
    <div className={cn("space-y-2 text-[11px] text-muted-foreground", className)}>
      <p className="font-semibold text-foreground">{impact.question}</p>
      <p className="text-[10px]">{impact.evidenceNote}</p>
      {!sufficient ? (
        <p className="rounded-md border border-amber-200 bg-amber-50/60 px-2 py-1.5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Insufficient historical evidence to confidently estimate impact.
        </p>
      ) : (
        <ul className="m-0 space-y-2 list-none p-0">
          {rows.map((row) => (
            <li
              key={row.change}
              className="rounded-md border border-border/60 bg-muted/10 px-2.5 py-2"
            >
              <p className="font-semibold text-foreground">{row.label}</p>
              <p className="mt-1">
                <span className="font-medium text-foreground">Business:</span> {row.businessImpact}
              </p>
              <p>
                <span className="font-medium text-foreground">Commercial:</span>{" "}
                {row.commercialImpact}
              </p>
              <p>
                <span className="font-medium text-foreground">Campaign:</span> {row.campaignImpact}
              </p>
              <p>
                <span className="font-medium text-foreground">Risk:</span> {row.riskImpact}
              </p>
              <p>
                <span className="font-medium text-foreground">Confidence:</span>{" "}
                {row.confidenceChange}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
