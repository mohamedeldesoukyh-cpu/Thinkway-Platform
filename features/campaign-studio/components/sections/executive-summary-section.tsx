"use client";

import { useEffect, useState } from "react";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { StudioEnterprisePlanningBrief } from "./shared/studio-enterprise-planning-brief";
import { loadStudioEciPlanningSignalsAction } from "../../actions/studio-eci-actions";
import {
  deriveEnterprisePlanningNarrative,
  type EnterprisePlanningNarrative,
} from "../../services/planning-narrative";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ExecutiveSummarySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

/**
 * Executive Planning Brief — first executive story of the Enterprise Planning Package.
 * Consumes the single Planning Narrative SSOT (same wording as Proposal / Presentation).
 */
export function ExecutiveSummarySection({
  campaignObject,
  fallbackText,
  status,
}: ExecutiveSummarySectionProps) {
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
      return <SectionPendingMessage label="Enterprise Planning Package pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-3.5">
      <StudioEnterprisePlanningBrief narrative={narrative} />
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-[11px] text-muted-foreground">
        <p className="font-semibold text-foreground">Continuous planning story</p>
        <ol className="mt-1.5 m-0 list-decimal space-y-1 pl-4">
          {narrative.spine.map((step) => (
            <li key={step.key}>
              <span className="font-medium text-foreground">{step.label}:</span> {step.body}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
