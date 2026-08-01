"use client";

import { useEffect, useState } from "react";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignBusinessTimeline } from "@/features/campaigns/lifecycle/components/campaign-business-timeline";
import { CampaignHealthStrip } from "@/features/campaigns/lifecycle/components/campaign-health-strip";
import { CampaignReadinessStrip } from "@/features/campaigns/lifecycle/components/campaign-readiness-strip";
import { CampaignRequirementsPanel } from "@/features/campaigns/lifecycle/components/campaign-requirements-panel";
import { cn } from "@/lib/utils";

const DETAILS_OPEN_KEY = "thinkway:campaign-lifecycle-details-open";

type Props = {
  lifecycle: CampaignLifecycleView;
  defaultOpen?: boolean;
  className?: string;
};

function readSessionOpen(fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(DETAILS_OPEN_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* sessionStorage unavailable */
  }
  return fallback;
}

/**
 * Progressive disclosure for secondary lifecycle surfaces.
 * Open/closed preference persists for the browser session across tab changes.
 */
export function CampaignLifecycleDetails({
  lifecycle,
  defaultOpen = false,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOpen(readSessionOpen(defaultOpen));
    setHydrated(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(DETAILS_OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open, hydrated]);

  return (
    <div className={cn("thinkway-lc-details", className)}>
      <button
        type="button"
        className="thinkway-lc-details-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>{open ? "▼" : "▶"}</span>
        Lifecycle Details
        <span className="thinkway-lc-details-hint">
          Requirements · Expected Outcome · Timeline · Health
        </span>
      </button>
      {open ? (
        <div className="thinkway-lc-details-body">
          <CampaignRequirementsPanel lifecycle={lifecycle} compact />
          <CampaignReadinessStrip lifecycle={lifecycle} />
          <CampaignHealthStrip lifecycle={lifecycle} />
          <CampaignBusinessTimeline lifecycle={lifecycle} />
        </div>
      ) : null}
    </div>
  );
}
