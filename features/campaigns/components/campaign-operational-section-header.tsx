"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CampaignOperationalSectionHeaderProps = {
  title: string;
  /** Muted suffix after title, e.g. "14 of 14" (reference: Deliverables · N of N). */
  countLabel?: string;
  description?: string;
  titleClassName?: string;
  actions?: ReactNode;
};

/** Matches reference section-head / tab toolbar title row. */
export function CampaignOperationalSectionHeader({
  title,
  countLabel,
  description,
  titleClassName,
  actions,
}: CampaignOperationalSectionHeaderProps) {
  return (
    <div className="flex w-full flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2
          className={cn(
            "text-[13px] font-bold text-[var(--camp-text)]",
            titleClassName
          )}
        >
          {title}
          {countLabel ? (
            <span className="font-normal text-[var(--camp-text-3)]"> · {countLabel}</span>
          ) : null}
        </h2>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-[var(--camp-text-3)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="thinkway-campaign-section-actions">{actions}</div>
      ) : null}
    </div>
  );
}
