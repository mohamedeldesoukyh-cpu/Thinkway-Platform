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
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
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

  const facts = getCampaignFacts(campaignObject);
  const compactFacts = [
    ["Objective", facts?.objective],
    ["Audience", facts?.audience],
    ["Platforms", facts?.platforms?.join(", ")],
  ].filter((item): item is [string, string] => Boolean(item[1]?.trim()));

  return (
    <div className="min-w-0 space-y-3">
      <div className="cs-strategy-grid">
        <div className="cs-strategy-group">
          <span className="cs-panel-label">Campaign approach</span>
          <p>{narrative.campaignStrategy}</p>
        </div>
        <div className="cs-strategy-group">
          <span className="cs-panel-label">Creator strategy</span>
          <p>{narrative.creatorStrategy}</p>
        </div>
        {compactFacts.map(([label, value]) => (
          <div key={label} className="cs-strategy-group">
            <span className="cs-panel-label">{label}</span>
            <p>{value}</p>
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-[12px] text-muted-foreground">
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
      {narrative.openDecisions.length > 0 ? (
        <section className="cs-open-decisions" aria-label="Open decisions">
          <span className="cs-panel-label">Open decisions</span>
          {narrative.openDecisions.map((item) => (
            <div key={`${item.decision}:${item.ownerHint}`} className="cs-open-decision">
              <span>{item.decision}</span>
              {item.ownerHint ? <span>{item.ownerHint}</span> : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
