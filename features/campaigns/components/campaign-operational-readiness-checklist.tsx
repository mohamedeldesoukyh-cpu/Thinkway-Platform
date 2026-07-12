"use client";

import { CheckIcon, CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignOperationalReadiness } from "@/lib/domains/commercial/campaign-operational-readiness";

export type CampaignOperationalReadinessChecklistProps = {
  readiness: CampaignOperationalReadiness;
  className?: string;
};

export function CampaignOperationalReadinessChecklist({
  readiness,
  className,
}: CampaignOperationalReadinessChecklistProps) {
  const highlightIds = new Set([
    "vendor_assignments",
    "assignment_deliverables",
    "commercials",
    "posting_dates",
    "campaign_lines",
  ]);

  const highlightedMandatory = readiness.mandatory.filter((item) =>
    highlightIds.has(item.id)
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-muted/20 px-3.5 py-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-foreground">Campaign Operational Readiness</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Informational checklist — does not block campaign actions.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            readiness.status === "operational_ready"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
          )}
        >
          {readiness.statusLabel}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {highlightedMandatory.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-[11px]">
            {item.satisfied ? (
              <CheckIcon className="size-3 text-emerald-600" aria-hidden />
            ) : (
              <CircleIcon className="size-3 text-muted-foreground/60" aria-hidden />
            )}
            <span className={item.satisfied ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      {readiness.mandatoryMissing.length > 0 ? (
        <p className="mt-2.5 text-[10px] text-amber-800 dark:text-amber-200">
          Still required:{" "}
          {readiness.mandatoryMissing.map((item) => item.label).join(" · ")}
        </p>
      ) : null}

      {readiness.optionalRemaining > 0 ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          {readiness.optionalRemaining} optional recommendation
          {readiness.optionalRemaining === 1 ? "" : "s"} remaining
        </p>
      ) : null}
    </div>
  );
}
