"use client";

import type { ReactNode } from "react";

import type { CampaignsKpis } from "@/features/campaigns/queries";
import { formatMoneyCompact } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type CampaignsListMastheadProps = {
  kpis: CampaignsKpis;
  actions?: ReactNode;
  className?: string;
};

/** Campaigns index masthead + metric strip (design suite). Real KPIs only. */
export function CampaignsListMasthead({
  kpis,
  actions,
  className,
}: CampaignsListMastheadProps) {
  const marginTone =
    kpis.avg_margin < 0 ? "r" : kpis.avg_margin >= 20 ? "g" : undefined;

  return (
    <div className={cn("tw-mast", className)}>
      <div className="tw-mh">
        <h1>Campaigns</h1>
        <span className="sub">
          Campaign command center — open a campaign to continue operational work
          in its workspace
        </span>
        <span className="tw-sp" />
        <span className="st">{kpis.total_campaigns} total</span>
        {actions}
      </div>
      <div className="tw-ms2">
        <div>
          <i>Campaigns</i>
          <b>{kpis.total_campaigns}</b>
        </div>
        <div>
          <i>Revenue</i>
          <b>{formatMoneyCompact(kpis.total_revenue, kpis.currency_code)}</b>
        </div>
        <div>
          <i>Avg margin</i>
          <b className={marginTone}>{kpis.avg_margin.toFixed(1)}%</b>
        </div>
        <div>
          <i>Assignments</i>
          <b>{kpis.assignments}</b>
        </div>
      </div>
    </div>
  );
}
