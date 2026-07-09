"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { GroundingBadge } from "./shared/grounding-badge";
import { PAIR_ANALYTICS_CARD, PAIR_ANALYTICS_GRID } from "../../constants/studio-layout";
import { resolveGroundedKpis } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type KpiForecastSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function KpiForecastSection({
  campaignObject,
  fallbackText,
  status,
}: KpiForecastSectionProps) {
  const isRunning = status === "running";
  const kpis = resolveGroundedKpis(campaignObject);

  if (isRunning && kpis.length === 0) {
    return <SectionSkeleton variant="cards" />;
  }

  if (kpis.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="KPI forecast pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className={PAIR_ANALYTICS_GRID}>
      {kpis.slice(0, 6).map((kpi, index) => (
        <div key={`${kpi.metric}-${index}`} className={PAIR_ANALYTICS_CARD}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              {kpi.metric}
            </p>
            <GroundingBadge source="Historical" confidence={kpi.confidence} />
          </div>
          <p className="mt-0.5 text-sm font-bold text-foreground">{kpi.prediction}</p>
          {kpi.platform ? (
            <p className="text-[9px] text-violet-600 capitalize">{kpi.platform}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-muted-foreground">{kpi.reason}</p>
          <p className="text-[9px] italic text-muted-foreground/80">Source: {kpi.calculationSource}</p>
          {kpi.benchmark ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">Benchmark: {kpi.benchmark}</p>
          ) : null}
          <Progress value={kpi.confidence} className={cn("mt-2 h-1.5", "[&>div]:bg-[#1D9E75]")} />
        </div>
      ))}
    </div>
  );
}
