"use client";

import { CheckIcon, CircleIcon } from "lucide-react";

import { CampaignSectionHead } from "@/features/campaigns/components/aurora/campaign-tab-layout";
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
    <div className={cn(className)}>
      <CampaignSectionHead
        title="Readiness"
        subtitle="Informational — does not block actions"
        tools={
          <span
            className={cn(
              "thinkway-aurora-pill",
              readiness.status === "operational_ready"
                ? "thinkway-aurora-pill-green"
                : "thinkway-aurora-pill-amber"
            )}
          >
            {readiness.statusLabel}
          </span>
        }
      />

      <div className="thinkway-aurora-ready" role="list" aria-label="Operational readiness">
        {highlightedMandatory.map((item) => (
          <span
            key={item.id}
            role="listitem"
            className={cn(
              "thinkway-aurora-rchip",
              item.satisfied ? "ok" : "todo"
            )}
          >
            {item.satisfied ? (
              <CheckIcon aria-hidden />
            ) : (
              <CircleIcon aria-hidden />
            )}
            {item.label}
          </span>
        ))}
      </div>

      {readiness.mandatoryMissing.length > 0 ? (
        <p className="mt-3 text-[12px] text-[var(--camp-amber-text)]">
          Still required:{" "}
          {readiness.mandatoryMissing.map((item) => item.label).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
