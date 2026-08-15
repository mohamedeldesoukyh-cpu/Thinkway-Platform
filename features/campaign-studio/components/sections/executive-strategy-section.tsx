"use client";

import { useEffect, useState } from "react";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { InsightGrid, ReasonCard } from "./shared/studio-ui-primitives";
import { loadStudioEciPlanningSignalsAction } from "../../actions/studio-eci-actions";
import {
  deriveEnterprisePlanningNarrative,
  type EnterprisePlanningNarrative,
} from "../../services/planning-narrative";
import { deriveInfluencerStrategyView } from "../../services/influencer-strategy-view";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ExecutiveStrategySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

/**
 * Executive Strategy — influencer-marketing checklist projected from the
 * single Planning Narrative + Campaign Facts (no second executive SSOT).
 */
export function ExecutiveStrategySection({
  campaignObject,
  fallbackText,
  status,
}: ExecutiveStrategySectionProps) {
  const [narrative, setNarrative] = useState<EnterprisePlanningNarrative | null>(null);

  useEffect(() => {
    if (!campaignObject) {
      setNarrative(null);
      return;
    }
    const creators = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
    const ids = creators.recommendations?.creatorIds ?? [];
    let cancelled = false;
    setNarrative(deriveEnterprisePlanningNarrative(campaignObject));
    if (ids.length === 0) return;
    void loadStudioEciPlanningSignalsAction(ids.slice(0, 40)).then((record) => {
      if (cancelled) return;
      setNarrative(
        deriveEnterprisePlanningNarrative(campaignObject, Object.values(record))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [campaignObject]);

  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  if (!narrative) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Executive strategy pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-[12px] text-muted-foreground">
        <span className="font-semibold text-foreground">Recommended business decision:</span>{" "}
        {narrative.recommendedBusinessDecision}
      </p>
      <InsightGrid>
        {campaignObject
          ? deriveInfluencerStrategyView(campaignObject, narrative).map((answer) => (
              <ReasonCard key={answer.key} label={answer.label} value={answer.body} />
            ))
          : null}
      </InsightGrid>
    </div>
  );
}
