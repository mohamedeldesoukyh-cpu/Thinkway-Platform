"use client";

import { format } from "date-fns";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  className?: string;
};

/** Epic 5 — business timeline (not raw DB activity log). */
export function CampaignBusinessTimeline({ lifecycle, className }: Props) {
  return (
    <section className={cn("thinkway-lc-timeline", className)} aria-label="Business timeline">
      <div className="thinkway-bp-label mb-2">Business Timeline</div>
      <ol className="thinkway-lc-timeline-list">
        {lifecycle.timeline.map((event) => (
          <li key={event.id} data-occurred={event.occurred ? "true" : "false"}>
            <span className="thinkway-lc-timeline-dot" aria-hidden />
            <div>
              <div className="thinkway-lc-timeline-label">{event.label}</div>
              <div className="thinkway-lc-muted">
                {event.owner}
                {event.at
                  ? ` · ${format(new Date(event.at), "MMM d, yyyy")}`
                  : event.occurred
                    ? " · Done"
                    : " · Upcoming"}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
