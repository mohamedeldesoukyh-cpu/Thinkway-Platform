"use client";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { businessStateLabel } from "@/lib/business-process/business-state";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  className?: string;
};

/** Epic 6 — dimensional campaign health. */
export function CampaignHealthStrip({ lifecycle, className }: Props) {
  return (
    <section className={cn("thinkway-lc-health", className)} aria-label="Campaign health">
      <div className="thinkway-bp-label mb-2">Campaign Health</div>
      <div className="thinkway-lc-health-grid">
        {lifecycle.health.map((slice) => (
          <div key={slice.id} className="thinkway-lc-health-cell" data-state={slice.state}>
            <div className="thinkway-lc-health-name">{slice.label}</div>
            <div className="thinkway-lc-health-state">{businessStateLabel(slice.state)}</div>
            <div className="thinkway-lc-muted">{slice.labelDetail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
