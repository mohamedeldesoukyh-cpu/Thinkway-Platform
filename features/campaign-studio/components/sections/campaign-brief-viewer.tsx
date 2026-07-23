"use client";

import { FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { hasCampaignBriefText } from "@/features/campaign-outputs/brief-media-plan-schedule";

type CampaignBriefViewerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignObject?: CampaignObject;
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

/** Read-only campaign brief viewer — shared across Studio Outputs and campaign workspaces. */
export function CampaignBriefViewer({ open, onOpenChange, campaignObject }: CampaignBriefViewerProps) {
  const briefText = resolveBriefText(campaignObject);
  const hasBrief = campaignObject ? hasCampaignBriefText(campaignObject) : false;
  const briefRef = campaignObject?.meta.campaignBriefRef;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-[min(100vw-2rem,720px)] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-4 py-3 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="size-4 text-[#1D9E75]" />
            Campaign brief
          </DialogTitle>
          <DialogDescription>
            {hasBrief
              ? "Client-approved brief attached to this campaign."
              : "No campaign brief has been uploaded yet."}
            {briefRef?.uploadedAt
              ? ` · Updated ${new Date(briefRef.uploadedAt).toLocaleDateString()}`
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {hasBrief ? (
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground">
              {briefText}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload or paste a campaign brief from the Campaign brief card to enable strategy mode on
              the Media Plan.
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
