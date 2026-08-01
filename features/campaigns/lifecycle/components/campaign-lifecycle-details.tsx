"use client";

import { useEffect, useState } from "react";

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignBusinessTimeline } from "@/features/campaigns/lifecycle/components/campaign-business-timeline";
import { CampaignHealthStrip } from "@/features/campaigns/lifecycle/components/campaign-health-strip";
import { CampaignProcessRail } from "@/features/campaigns/lifecycle/components/campaign-process-rail";
import { CampaignReadinessStrip } from "@/features/campaigns/lifecycle/components/campaign-readiness-strip";
import { CampaignRequirementsPanel } from "@/features/campaigns/lifecycle/components/campaign-requirements-panel";
import { cn } from "@/lib/utils";

const DETAILS_OPEN_KEY = "thinkway:campaign-lifecycle-details-open";

type Props = {
  lifecycle: CampaignLifecycleView;
  defaultOpen?: boolean;
  onSelectStage?: (tab: CampaignWorkspaceTabId) => void;
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
 * Journey / unlocks / health / requirements / timeline — collapsed by default.
 */
export function CampaignLifecycleDetails({
  lifecycle,
  defaultOpen = false,
  onSelectStage,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);
  const dc = lifecycle.decisionCenter;

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
          Journey · Unlock · Requirements · Health · Timeline
        </span>
      </button>
      {open ? (
        <div className="thinkway-lc-details-body">
          <CampaignProcessRail
            lifecycle={lifecycle}
            onSelectStage={onSelectStage}
            density="full"
          />
          <div className="thinkway-lc-details-unlock">
            <div className="thinkway-bp-label">{dc.unlockHeadline}</div>
            <ul className="thinkway-lc-decision-unlocks">
              {dc.unlocks.map((item) => (
                <li key={item.id}>
                  <span aria-hidden>✓</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <CampaignRequirementsPanel lifecycle={lifecycle} compact />
          <CampaignReadinessStrip lifecycle={lifecycle} />
          <CampaignHealthStrip lifecycle={lifecycle} />
          <CampaignBusinessTimeline lifecycle={lifecycle} />
        </div>
      ) : null}
    </div>
  );
}
