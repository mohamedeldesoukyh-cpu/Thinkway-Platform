"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { Col2Bullets } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveExecutiveSummaryData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ExecutiveSummarySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function ExecutiveSummarySection({
  campaignObject,
  fallbackText,
  status,
}: ExecutiveSummarySectionProps) {
  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const data = resolveExecutiveSummaryData(campaignObject);
  if (!data) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Executive summary pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-3.5">
      <div className={STUDIO_CLASSES.execBox}>
        <p className={STUDIO_CLASSES.body}>{data.summary}</p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Col2Bullets label="Key Decisions" items={data.keyDecisions} />
        <Col2Bullets label="Recommended Actions" items={data.recommendedActions} />
        {data.immediateNextSteps.length > 0 ? (
          <Col2Bullets label="Immediate Next Steps" items={data.immediateNextSteps} />
        ) : null}
      </div>
    </div>
  );
}
