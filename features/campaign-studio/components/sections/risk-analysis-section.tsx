"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import { severityColor } from "./shared/format-utils";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveRiskData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";
import { cn } from "@/lib/utils";

type RiskAnalysisSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

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
        }))
      : (riskData.enrichedRisks ?? []);

  return (
    <div className="min-w-0 space-y-3">
      {riskData.overallRiskLevel ? (
        <span className={cn(STUDIO_CLASSES.pillFit, "capitalize")}>
          Overall: {riskData.overallRiskLevel}
        </span>
      ) : null}
      {items.slice(0, 5).map((item, index) => (
        <div key={`${item.risk}-${index}`} className={STUDIO_CLASSES.riskCard}>
          <p className="text-[13px] font-extrabold text-foreground">
            {item.risk}{" "}
            <span
              className={cn(
                "ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold capitalize",
                severityColor(item.severity)
              )}
            >
              {item.severity}
            </span>
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-1.5 text-[11.5px] sm:grid-cols-2">
            <div>
              <span className="font-bold text-[#6B7280]">Probability:</span>{" "}
              <span className="font-semibold capitalize text-foreground">{item.probability}</span>
            </div>
            <div>
              <span className="font-bold text-[#6B7280]">Impact:</span>{" "}
              <span className="font-semibold text-foreground">{item.impact}</span>
            </div>
            <div>
              <span className="font-bold text-[#6B7280]">Mitigation:</span>{" "}
              <span className="font-semibold text-foreground">{item.mitigation}</span>
            </div>
            <div>
              <span className="font-bold text-[#6B7280]">Owner:</span>{" "}
              <span className="font-semibold text-foreground">{item.owner}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
