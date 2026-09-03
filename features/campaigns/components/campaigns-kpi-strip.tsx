"use client";

import { CampaignsListMasthead } from "@/features/campaigns/components/campaigns-list-masthead";
import type { CampaignsKpis } from "@/features/campaigns/queries";

type CampaignsKpiStripProps = {
  kpis: CampaignsKpis;
  className?: string;
};

/** @deprecated Prefer CampaignsListMasthead — kept for docs/hand-off references. */
export function CampaignsKpiStrip({ kpis, className }: CampaignsKpiStripProps) {
  return <CampaignsListMasthead kpis={kpis} className={className} />;
}
