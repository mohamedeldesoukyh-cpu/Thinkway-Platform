"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { BudgetRow } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
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
    <div className="min-w-0">
      {kpis.slice(0, 6).map((kpi, index) => (
        <BudgetRow
          key={`${kpi.metric}-${index}`}
          name={kpi.metric}
          amount={kpi.prediction}
          trailing={
            kpi.confidence != null ? (
              <span className={STUDIO_CLASSES.pillFit}>
                Historical · {kpi.confidence}%
              </span>
            ) : null
          }
        />
      ))}
    </div>
  );
}
