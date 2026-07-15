"use client";

import { useMemo, useState } from "react";
import { FileTextIcon, PencilIcon, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { hasCampaignBriefText } from "@/features/campaign-outputs/brief-media-plan-schedule";

import { CampaignBriefDialog } from "./campaign-brief-dialog";

const PREVIEW_MAX_CHARS = 160;

type CampaignBriefCardProps = {
  campaignObject?: CampaignObject;
  conversationId?: string;
  messageId?: string;
  onBriefApplied?: (campaignObject: Record<string, unknown>) => void;
  className?: string;
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
}: CampaignBriefCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const briefText = useMemo(() => resolveBriefText(campaignObject), [campaignObject]);
  const hasBrief = campaignObject ? hasCampaignBriefText(campaignObject) : false;
  const preview = hasBrief ? truncatePreview(briefText) : null;
  const canEdit = Boolean(conversationId && messageId);

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-sm transition-shadow hover:shadow-md",
          className
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <FileTextIcon className="size-3.5 shrink-0 text-[#1D9E75]" />
              <h3 className="truncate text-sm font-bold text-foreground">Campaign brief</h3>
            </div>
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-muted-foreground">
              {preview ?? "No brief yet — add the client brief to refine scheduling and strategy."}
            </p>
          </div>
          {hasBrief ? (
            <span className="shrink-0 rounded-full bg-[#1D9E75]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1D9E75]">
              Active
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-1">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setDialogOpen(true)}
            className={cn(
              "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto",
              hasBrief
                ? "border border-border text-foreground/80 hover:bg-muted/60"
                : "bg-[#1D9E75] text-white hover:bg-[#178a66]"
            )}
          >
            {hasBrief ? (
              <>
                <PencilIcon className="size-3.5" />
                Edit brief
              </>
            ) : (
              <>
                <PlusIcon className="size-3.5" />
                Add brief
              </>
            )}
          </button>
        </div>
      </div>

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
