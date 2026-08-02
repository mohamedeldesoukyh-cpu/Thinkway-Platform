"use client";



import { useMemo, useState } from "react";

import { EyeIcon, PencilIcon, PlusIcon } from "lucide-react";



import { cn } from "@/lib/utils";

import { OUTPUTS_CLASSES } from "@/features/campaign-outputs/constants/outputs-center-tokens";

import type { CampaignObject } from "@/features/campaign-intelligence";

import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import { hasCampaignBriefText } from "@/features/campaign-outputs/brief-media-plan-schedule";

import { STUDIO_REF_CLASSES } from "../../constants/campaign-studio-ref-tokens";
import { useStudioRefMode } from "../../hooks/use-studio-ref-mode";

import { deriveEnterprisePlanningNarrative } from "../../services/planning-narrative";

import { CampaignBriefDialog } from "./campaign-brief-dialog";

import { CampaignBriefViewer } from "./campaign-brief-viewer";



const PREVIEW_MAX_CHARS = 160;



type CampaignBriefCardProps = {

  campaignObject?: CampaignObject;

  conversationId?: string;

  messageId?: string;

  onBriefApplied?: (campaignObject: Record<string, unknown>) => void;

  className?: string;

  compact?: boolean;

};



function resolveBriefText(campaignObject?: CampaignObject): string {

  if (!campaignObject) return "";

  const facts = getCampaignFacts(campaignObject);

  return (

    facts?.rawBriefExcerpt?.trim() ||

    (typeof campaignObject.sections.summary?.content === "string"

      ? campaignObject.sections.summary.content.trim()

      : "")

  );

}



function truncatePreview(text: string): string {

  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= PREVIEW_MAX_CHARS) return normalized;

  return `${normalized.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…`;

}



export function CampaignBriefCard({

  campaignObject,

  conversationId,

  messageId,

  onBriefApplied,

  className,

  compact = false,

}: CampaignBriefCardProps) {

  const [dialogOpen, setDialogOpen] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);

  const refMode = useStudioRefMode();



  const briefText = useMemo(() => resolveBriefText(campaignObject), [campaignObject]);

  const hasBrief = campaignObject ? hasCampaignBriefText(campaignObject) : false;

  const preview = hasBrief ? truncatePreview(briefText) : null;

  const canEdit = Boolean(conversationId && messageId);

  const completeness = useMemo(
    () =>
      campaignObject
        ? deriveEnterprisePlanningNarrative(campaignObject).briefCompleteness
        : null,
    [campaignObject]
  );



  if (refMode) {
    return (
      <>
        {hasBrief ? <span className={STUDIO_REF_CLASSES.briefStatus}>Active</span> : null}
        <div className={cn(STUDIO_REF_CLASSES.briefText, className)}>
          {preview ??
            "No planning request yet — add a marketing brief, objective, or planning input to start the Enterprise Planning Package."}
        </div>
        {completeness ? (
          <div className="mb-2 text-[11px] text-muted-foreground">
            <b className="text-foreground">
              Planning completeness {completeness.scorePercent}%
            </b>
            {" — "}
            {completeness.summary}
            {completeness.missingLabels.length > 0 ? (
              <ul className="mt-1 list-disc pl-4">
                {completeness.missingLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className={STUDIO_REF_CLASSES.briefActions}>
          {hasBrief ? (
            <button type="button" onClick={() => setViewerOpen(true)}>
              <EyeIcon className="size-3" aria-hidden />
              View brief
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canEdit && !hasBrief}
            onClick={() => setDialogOpen(true)}
          >
            {hasBrief ? (
              <>
                <PencilIcon className="size-3" aria-hidden />
                Edit brief
              </>
            ) : (
              <>
                <PlusIcon className="size-3" aria-hidden />
                Add brief
              </>
            )}
          </button>
        </div>

        <CampaignBriefViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          campaignObject={campaignObject}
        />
        <CampaignBriefDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialBriefText={briefText}
          conversationId={conversationId}
          messageId={messageId}
          onBriefApplied={onBriefApplied}
        />
      </>
    );
  }



  return (

    <>

      <div className={cn(OUTPUTS_CLASSES.ocard, className)}>

        <div className={OUTPUTS_CLASSES.ocardTop}>

          <div className="oc-ocard-title-row">

            <h3>Campaign brief</h3>

            {hasBrief ? (

              <span className={cn(OUTPUTS_CLASSES.cornerBadge, "active")}>Active</span>

            ) : null}

          </div>

          <p className="oc-ocard-desc">

            {preview ??
              "No planning request yet — add a marketing brief, objective, or planning input to start the Enterprise Planning Package."}

          </p>

          {completeness ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              <b className="text-foreground">
                Planning completeness {completeness.scorePercent}%
              </b>
              {" — "}
              {completeness.summary}
              {completeness.missingLabels.length > 0 ? (
                <ul className="mt-1 list-disc pl-4">
                  {completeness.missingLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

        </div>



        <div className={OUTPUTS_CLASSES.ocardActions}>

          <div className="oc-action-row">

            {hasBrief ? (

              <button

                type="button"

                onClick={() => setViewerOpen(true)}

                className={OUTPUTS_CLASSES.aicon}

              >

                <EyeIcon aria-hidden />

                View brief

              </button>

            ) : null}

            <button

              type="button"

              disabled={!canEdit && !hasBrief}

              onClick={() => setDialogOpen(true)}

              className={OUTPUTS_CLASSES.aicon}

            >

              {hasBrief ? (

                <>

                  <PencilIcon aria-hidden />

                  Edit brief

                </>

              ) : (

                <>

                  <PlusIcon aria-hidden />

                  Add brief

                </>

              )}

            </button>

          </div>

        </div>

      </div>



      <CampaignBriefViewer

        open={viewerOpen}

        onOpenChange={setViewerOpen}

        campaignObject={campaignObject}

      />



      <CampaignBriefDialog

        open={dialogOpen}

        onOpenChange={setDialogOpen}

        initialBriefText={briefText}

        conversationId={conversationId}

        messageId={messageId}

        onBriefApplied={onBriefApplied}

      />

    </>

  );

}

