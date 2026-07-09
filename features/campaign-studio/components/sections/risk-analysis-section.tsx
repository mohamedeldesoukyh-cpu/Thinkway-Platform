"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { severityColor } from "./shared/format-utils";
import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { PAIR_ANALYTICS_CARD, PAIR_ANALYTICS_GRID } from "../../constants/studio-layout";
import { resolveRiskData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type RiskAnalysisSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

const PROBABILITY_COLOR = {
  low: "text-[#1D9E75]",
  medium: "text-amber-600",
  high: "text-red-600",
} as const;

export function RiskAnalysisSection({
  campaignObject,
  fallbackText,
  status,
}: RiskAnalysisSectionProps) {
  const isRunning = status === "running";
  const riskData = resolveRiskData(campaignObject);

  if (isRunning && !riskData) {
    return <SectionSkeleton variant="cards" />;
  }

  if (!riskData) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Risk analysis pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  const items =
    riskData.risks.length > 0
      ? riskData.risks.map((r) => ({
          risk: r.risk,
          severity: r.severity,
          probability: "medium" as const,
          impact: r.category ?? "Operations",
          mitigation: r.mitigation ?? "Under review",
          owner: "Campaign team",
          status: r.severity === "high" ? ("Action required" as const) : ("Monitoring" as const),
        }))
      : (riskData.enrichedRisks ?? []);

  return (
    <div className="min-w-0 space-y-2">
      {riskData.overallRiskLevel ? (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
            Overall
          </span>
          <Badge className={cn("border capitalize", severityColor(riskData.overallRiskLevel))}>
            {riskData.overallRiskLevel}
          </Badge>
        </div>
      ) : null}
      <div className={PAIR_ANALYTICS_GRID}>
      {items.slice(0, 5).map((item, index) => (
        <div key={`${item.risk}-${index}`} className={PAIR_ANALYTICS_CARD}>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{item.risk}</p>
            <Badge className={cn("shrink-0 border capitalize", severityColor(item.severity))}>
              {item.severity}
            </Badge>
          </div>
          <div className="mt-2 grid min-w-0 gap-1.5 break-words text-[11px]">
            <div className="flex min-w-0 gap-2">
              <span className="shrink-0 font-semibold text-muted-foreground">Probability:</span>
              <span className={cn("capitalize [overflow-wrap:anywhere]", PROBABILITY_COLOR[item.probability])}>
                {item.probability}
              </span>
            </div>
            <div className="flex min-w-0 gap-2">
              <span className="shrink-0 font-semibold text-muted-foreground">Impact:</span>
              <span className="text-foreground [overflow-wrap:anywhere]">{item.impact}</span>
            </div>
            <div className="flex min-w-0 gap-2">
              <span className="shrink-0 font-semibold text-muted-foreground">Mitigation:</span>
              <span className="text-foreground [overflow-wrap:anywhere]">{item.mitigation}</span>
            </div>
            <div className="flex min-w-0 gap-2">
              <span className="shrink-0 font-semibold text-muted-foreground">Owner:</span>
              <span className="text-foreground [overflow-wrap:anywhere]">{item.owner}</span>
            </div>
            <div className="flex min-w-0 gap-2">
              <span className="shrink-0 font-semibold text-muted-foreground">Status:</span>
              <span className={item.status === "Action required" ? "text-red-600" : "text-[#1D9E75]"}>
                {item.status}
              </span>
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
