"use client";

import { useEffect, useState } from "react";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { ObjectiveBadge } from "./shared/studio-ui-primitives";
import { STUDIO_REF_CLASSES } from "../../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { useStudioRefMode } from "../../hooks/use-studio-ref-mode";
import {
  CAMPAIGN_CREATOR_STATUS_LABEL,
  campaignContentBasisLine,
  isCreatorRejected,
} from "../../services/creator-decision-status";
import { resolveContentPlanState } from "../../services/section-data-resolver";
import { previewCreatorsSectionFromDraft } from "../../services/studio-draft-preview";
import { getConversationCampaignIntelligenceAction } from "@/features/campaign-intelligence-profile/actions/profile-actions";
import type { CampaignUnderstanding } from "@/features/campaign-intelligence-profile/types/campaign-understanding";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ContentPlanSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
  /** Staged Studio edits — Content reads the slate the Creators screen shows. */
  studioDraft?: StudioDraftState;
  conversationId?: string;
};

export function ContentPlanSection({
  campaignObject,
  fallbackText,
  status,
  studioDraft,
  conversationId,
}: ContentPlanSectionProps) {
  const refMode = useStudioRefMode();
  // `undefined` means the existing profile lookup is still pending; `null`
  // means this is a legacy campaign with no profile to consume.
  const [campaignUnderstanding, setCampaignUnderstanding] = useState<CampaignUnderstanding | null | undefined>(
    conversationId ? undefined : null
  );

  useEffect(() => {
    setCampaignUnderstanding(undefined);
    if (!conversationId) return;
    let cancelled = false;
    void getConversationCampaignIntelligenceAction(conversationId)
      .then((result) => {
        if (!cancelled) setCampaignUnderstanding(result?.profile.campaignUnderstanding ?? null);
      })
      // Keep the established legacy Content read path available when the
      // profile is not reachable; the boundary reports legacy provenance
      // rather than leaving an unhandled client promise.
      .catch(() => {
        if (!cancelled) setCampaignUnderstanding(null);
      });
    return () => { cancelled = true; };
  }, [conversationId]);

  if (status === "running" && !fallbackText.trim() && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  // The same projection the Creators screen renders: staged edits included, so
  // the two screens cannot report different slate sizes. `outdatedSectionsForDraft`
  // still badges this section until Apply.
  const contentState = campaignUnderstanding === undefined && conversationId
    ? undefined
    : resolveContentPlanState(campaignObject, studioDraft, campaignUnderstanding ?? undefined);
  const items = contentState?.items ?? [];
  const creatorsData = (
    campaignObject && studioDraft && studioDraft.changes.length > 0
      ? previewCreatorsSectionFromDraft(campaignObject, studioDraft)
      : ((campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData)
  ) as CreatorsSectionData;
  const slateRows = creatorsData.recommendations?.selectedReasoning ?? [];
  const basisLine = campaignContentBasisLine({
    creatorCount: items.length,
    rejectedCount: slateRows.filter(
      (row) => row.creatorId?.trim() && isCreatorRejected(creatorsData.vendorDecisions, row.creatorId)
    ).length,
  });
  const staged = Boolean(studioDraft?.changes.length);
  const activeSlateCount = slateRows.filter(
    (row) => !row.creatorId?.trim() || !isCreatorRejected(creatorsData.vendorDecisions, row.creatorId)
  ).length;
  if (conversationId && campaignUnderstanding === undefined) {
    return <SectionPendingMessage label="Checking Campaign Intelligence…" />;
  }
  if (contentState?.context.readiness.status === "BLOCKED") {
    return (
      <SectionFallbackContent
        text={`Content planning is blocked: ${contentState.context.readiness.blockers.join(" ")}`}
      />
    );
  }
  if (items.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Content plan pending…" />;
    }
    return (
      <SectionFallbackContent
        text={
          fallbackText.trim() ||
          "Per-creator content plan appears after Strategy and creator recommendations are in place."
        }
      />
    );
  }

  const tableClass = refMode ? STUDIO_REF_CLASSES.planTable : STUDIO_CLASSES.ptable;
  const thClass = refMode ? undefined : STUDIO_CLASSES.ptableTh;
  const tdClass = refMode ? undefined : STUDIO_CLASSES.ptableTd;

  return (
    <div className="overflow-x-auto">
      <div className="cs-slate-context" role="status">
        <b>{activeSlateCount || items.length} creator{(activeSlateCount || items.length) === 1 ? "" : "s"} in this content plan</b>
        <span>
          {staged
            ? "Showing the staged slate preview until Apply Changes commits it."
            : "Content follows the current campaign slate."}
        </span>
      </div>
      {contentState?.context.readiness.status === "WARNING" ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          {contentState.context.readiness.warnings.join(" ")}
        </p>
      ) : null}
      <table className={tableClass}>
        <caption className="sr-only">Per-creator influencer content plan</caption>
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Creator / Role
            </th>
            <th scope="col" className={thClass}>
              Platform
            </th>
            <th scope="col" className={thClass}>
              Deliverable
            </th>
            <th scope="col" className={thClass}>
              Concept
            </th>
            <th scope="col" className={thClass}>
              Hook
            </th>
            <th scope="col" className={thClass}>
              Key message
            </th>
            <th scope="col" className={thClass}>
              CTA
            </th>
            <th scope="col" className={thClass}>
              Timing
            </th>
            <th scope="col" className={thClass}>
              Objective
            </th>
            <th scope="col" className={thClass}>
              Expected KPI
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.creatorId ?? item.platform}-${index}`}>
              <td className={tdClass}>
                <span className="font-semibold">{item.creatorName ?? "Creator"}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {item.creatorRole ?? item.creatorTier}
                </span>
                {/*
                  Every row states what its creator is. Content reads the
                  working slate, so an unlabelled row read as an approved
                  campaign creator.
                */}
                {item.creatorStatus ? (
                  <span className="mt-0.5 inline-block rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                    {CAMPAIGN_CREATOR_STATUS_LABEL[item.creatorStatus]}
                  </span>
                ) : null}
              </td>
              <td className={tdClass}>{item.platform}</td>
              <td className={tdClass}>{item.contentType}</td>
              <td className={tdClass}>{item.contentConcept ?? "—"}</td>
              <td className={tdClass}>{item.hook ?? "—"}</td>
              <td className={tdClass}>{item.keyMessage ?? "—"}</td>
              <td className={tdClass}>{item.cta ?? "—"}</td>
              <td className={tdClass}>{item.postingDate}</td>
              <td className={tdClass}>
                <ObjectiveBadge objective={item.objective} />
              </td>
              <td className={tdClass}>{item.expectedKpi ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">{basisLine}</p>
      {items[0]?.strategyTrace ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{items[0].strategyTrace}</p>
      ) : null}
    </div>
  );
}
