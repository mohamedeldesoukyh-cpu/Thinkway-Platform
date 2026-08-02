"use client";

import { useEffect, useState } from "react";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { Col2Bullets } from "./shared/studio-ui-primitives";
import { STUDIO_REF_CLASSES } from "../../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { useStudioRefMode } from "../../hooks/use-studio-ref-mode";
import { resolveExecutiveSummaryData } from "../../services/section-data-resolver";
import { loadStudioEciPlanningSignalsAction } from "../../actions/studio-eci-actions";
import {
  buildStudioExecutivePlanningSummary,
  type StudioExecutivePlanningSummary,
} from "../../services/eci/executive-planning-view";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ExecutiveSummarySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

function PlanningBrief({ brief }: { brief: StudioExecutivePlanningSummary }) {
  return (
    <div className="space-y-2.5 rounded-[14px] border border-[#0057FF]/20 bg-[#0057FF]/5 p-3.5">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#0057FF]">
        Executive Planning Brief
      </p>
      <ul className="m-0 space-y-1.5 list-none p-0 text-[12.5px] text-foreground">
        <li>
          <b>Campaign Objective:</b> {brief.campaignObjective}
        </li>
        <li>
          <b>Recommended Option:</b> {brief.recommendedOption}
        </li>
        <li>
          <b>Why recommended:</b> {brief.recommendedStrategy}
        </li>
        <li>
          <b>Recommended Creator Mix:</b> {brief.recommendedCreatorMix}
        </li>
        <li>
          <b>Commercial Outlook:</b> {brief.commercialOutlook}
        </li>
        <li>
          <b>Business Risks:</b> {brief.businessRisks}
        </li>
        <li>
          <b>Expected Business Results:</b> {brief.expectedBusinessResults}
        </li>
        <li>
          <b>Alternative Option:</b> {brief.alternativeOption}
        </li>
        <li>
          <b>Why not selected:</b> {brief.whyAlternativeNotSelected}
        </li>
        <li>
          <b>Trade-offs:</b> {brief.tradeOffs}
        </li>
        <li>
          <b>Decision Impact:</b> {brief.decisionImpactSummary}
        </li>
        <li>
          <b>Planning Confidence:</b> {brief.planningConfidence.level} —{" "}
          {brief.planningConfidence.why}
        </li>
      </ul>
      <p className="text-[10px] text-muted-foreground">
        Evidence: {brief.planningConfidence.evidenceSupports} Assumptions:{" "}
        {brief.planningConfidence.assumptions}
      </p>
    </div>
  );
}

/**
 * Executive Summary — always capable of producing a planning brief for executives.
 * Enhances existing section content; does not redesign Studio or change workflows.
 */
export function ExecutiveSummarySection({
  campaignObject,
  fallbackText,
  status,
}: ExecutiveSummarySectionProps) {
  const refMode = useStudioRefMode();
  const [brief, setBrief] = useState<StudioExecutivePlanningSummary | null>(null);

  useEffect(() => {
    if (!campaignObject) {
      setBrief(null);
      return;
    }
    const creators = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
    const ids = creators.recommendations?.creatorIds ?? [];
    let cancelled = false;

    const base = buildStudioExecutivePlanningSummary(campaignObject);
    setBrief(base);

    if (ids.length === 0) return;

    void loadStudioEciPlanningSignalsAction(ids.slice(0, 40)).then((record) => {
      if (cancelled) return;
      const signals = Object.values(record);
      setBrief(buildStudioExecutivePlanningSummary(campaignObject, signals));
    });

    return () => {
      cancelled = true;
    };
  }, [campaignObject]);

  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const data = resolveExecutiveSummaryData(campaignObject);
  const hasBrief = Boolean(brief);

  if (!data && !hasBrief) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Executive summary pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  if (refMode) {
    return (
      <>
        {brief ? <PlanningBrief brief={brief} /> : null}
        {data ? (
          <>
            <div className={STUDIO_REF_CLASSES.execSummaryTxt}>{data.summary}</div>
            <div className={STUDIO_REF_CLASSES.execCols}>
              <Col2Bullets label="Key decisions" items={data.keyDecisions} tone="decisions" />
              <Col2Bullets label="Recommended actions" items={data.recommendedActions} tone="actions" />
            </div>
            {data.immediateNextSteps.length > 0 ? (
              <Col2Bullets
                label="Immediate next steps"
                items={data.immediateNextSteps}
                tone="next"
              />
            ) : null}
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="min-w-0 space-y-3.5">
      {brief ? <PlanningBrief brief={brief} /> : null}

      {data ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}
