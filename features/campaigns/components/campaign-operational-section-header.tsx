"use client";

import type { ReactNode } from "react";

type CampaignOperationalSectionHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Matches Assignments tab toolbar (title row + optional subtitle + actions). */
export function CampaignOperationalSectionHeader({
  title,
  description,
  actions,
}: CampaignOperationalSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? (
        <p className="max-w-3xl text-[11px] leading-snug text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
