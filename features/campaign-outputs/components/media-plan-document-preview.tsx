"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { CampaignOutputContent } from "../output-types";
import type { MediaPlanCampaignContext, MediaPlanData } from "../generators/media-plan";
import { buildMediaPlanPreviewHtmlDocument } from "../export/media-plan-html";
import { INFLUENCER_CONCEPTS_EXPAND_MESSAGE } from "../influencer-concepts";
import {
  MEDIA_PLAN_SECTION_TOGGLE_MESSAGE,
  readMediaPlanPresentation,
  serializeMediaPlanPresentationKey,
  type MediaPlanSectionKey,
} from "../media-plan-presentation";
import { refreshMediaPlanStrategySummaryForDisplay } from "../media-plan-strategy-summary";
import { InfluencerConceptsModal } from "./influencer-concepts-modal";

function resolvePreviewInfluencerConcepts(
  content: CampaignOutputContent,
  contextOverride?: MediaPlanCampaignContext
) {
  const data = content.data as MediaPlanData | undefined;
  if (!data?.strategySummary) return [];

  const summary =
    refreshMediaPlanStrategySummaryForDisplay(data.strategySummary, data) ?? data.strategySummary;

  return summary.influencerConcepts ?? [];
}

/**
 * Isolated iframe preview — same EMediaPlan HTML as export, scaled to the panel width.
 * Tailwind and dashboard styles cannot leak in; layout matches the reference document.
 * Influencer Concepts expand via postMessage → centered React modal rendered outside the iframe.
 */
export function MediaPlanDocumentPreview({
  content,
  mediaPlanContextOverride,
  campaignObject,
  onInfluencerConceptsPersist,
  showSectionToggles = false,
  onSectionVisibilityChange,
}: {
  content: CampaignOutputContent;
  mediaPlanContextOverride?: MediaPlanCampaignContext;
  campaignObject?: CampaignObject;
  onInfluencerConceptsPersist?: (next: CampaignObject) => void | Promise<void>;
  /** Internal preview — render hide toggles on section headers (not export). */
  showSectionToggles?: boolean;
  onSectionVisibilityChange?: (section: MediaPlanSectionKey, visible: boolean) => void;
}) {
  const [conceptsOpen, setConceptsOpen] = useState(false);
  const onSectionVisibilityChangeRef = useRef(onSectionVisibilityChange);
  onSectionVisibilityChangeRef.current = onSectionVisibilityChange;

  const influencerConcepts = useMemo(
    () => resolvePreviewInfluencerConcepts(content, mediaPlanContextOverride),
    [content, mediaPlanContextOverride]
  );

  const platformAllocation = useMemo(() => {
    const data = content.data as MediaPlanData | undefined;
    return data?.platformAllocation;
  }, [content.data]);

  const presentationKey = useMemo(
    () =>
      campaignObject
        ? serializeMediaPlanPresentationKey(readMediaPlanPresentation(campaignObject))
        : "",
    [campaignObject?.id, campaignObject?.updatedAt, campaignObject?.meta.mediaPlanPresentation]
  );

  const presentation = useMemo(
    () => (campaignObject ? readMediaPlanPresentation(campaignObject) : undefined),
    [presentationKey, campaignObject]
  );

  const contentKey = useMemo(() => `${content.title}:${content.summary ?? ""}`, [content.title, content.summary]);

  const srcDoc = useMemo(
    () =>
      buildMediaPlanPreviewHtmlDocument(content, {
        contextOverride: mediaPlanContextOverride,
        presentation: presentation
          ? { ...presentation, view: presentation.view ?? "internal" }
          : undefined,
        showSectionToggles,
      }),
    [contentKey, presentationKey, showSectionToggles, presentation, content, mediaPlanContextOverride]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === INFLUENCER_CONCEPTS_EXPAND_MESSAGE) {
        if (!influencerConcepts.length) return;
        setConceptsOpen(true);
        return;
      }

      if (event.data?.type === MEDIA_PLAN_SECTION_TOGGLE_MESSAGE) {
        const section = event.data.section as MediaPlanSectionKey | undefined;
        const visible = event.data.visible as boolean | undefined;
        if (!section || typeof visible !== "boolean") return;
        onSectionVisibilityChangeRef.current?.(section, visible);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [influencerConcepts.length]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <iframe
          title={`${content.title} — Media Plan`}
          srcDoc={srcDoc}
          className="min-h-0 flex-1 border-0 bg-transparent"
          sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
      {influencerConcepts.length ? (
        <InfluencerConceptsModal
          concepts={influencerConcepts}
          campaignObject={campaignObject}
          platformAllocation={platformAllocation}
          onPersist={onInfluencerConceptsPersist}
          open={conceptsOpen}
          onOpenChange={setConceptsOpen}
          hideTrigger
        />
      ) : null}
    </>
  );
}
