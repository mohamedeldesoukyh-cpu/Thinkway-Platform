"use client";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  className?: string;
};

/** Epic 10 — campaign readiness checklist. */
export function CampaignReadinessStrip({ lifecycle, className }: Props) {
  return (
    <section className={cn("thinkway-lc-readiness", className)} aria-label="Campaign readiness">
      <div className="thinkway-bp-label mb-2">Campaign Readiness</div>
      <div className="thinkway-lc-readiness-grid">
        {lifecycle.readiness.map((item) => (
          <div key={item.id} className="thinkway-lc-readiness-cell" data-state={item.state}>
            <span>{item.label}</span>
            <strong>{item.detail}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
