"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

import {
  applyCampaignBriefAction,
  extractBriefFileTextAction,
} from "../../actions/campaign-brief-actions";

/** Matches the server-side floor in applyCampaignBriefAction. */
const MIN_BRIEF_CHARS = 40;

type CampaignBriefDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBriefText: string;
  conversationId?: string;
  messageId?: string;
  onBriefApplied?: (campaignObject: Record<string, unknown>) => void;
  /** Canonical intelligence re-analyzed from the saved brief. */
  onIntelligenceReanalyzed?: (input: {
    profileId: string;
    profile: CampaignIntelligenceProfile;
  }) => void;
};

export function CampaignBriefDialog({
  open,
  onOpenChange,
  initialBriefText,
  conversationId,
  messageId,
  onBriefApplied,
  onIntelligenceReanalyzed,
}: CampaignBriefDialogProps) {
  const [briefText, setBriefText] = useState(initialBriefText);
  const [pending, startTransition] = useTransition();
  const [extracting, startExtracting] = useTransition();

  useEffect(() => {
    if (open) setBriefText(initialBriefText);
  }, [open, initialBriefText]);

  const canSave = Boolean(
    conversationId && messageId && briefText.trim().length >= MIN_BRIEF_CHARS
  );

  const saveBrief = useCallback(() => {
    if (!canSave) return;
    startTransition(async () => {
      const result = await applyCampaignBriefAction({
        conversationId: conversationId!,
        messageId: messageId!,
        briefText: briefText.trim(),
      });
      if (result.ok) {
        toast.success(result.message);
        // Intake reads the re-analyzed profile the action just persisted — the
        // canonical data changed, so no reload or re-poll is needed.
        if (result.profileId && result.profile) {
          onIntelligenceReanalyzed?.({ profileId: result.profileId, profile: result.profile });
        }
        if (result.campaignObject) onBriefApplied?.(result.campaignObject);
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }, [
    briefText,
    canSave,
    conversationId,
    messageId,
    onBriefApplied,
    onIntelligenceReanalyzed,
    onOpenChange,
  ]);

  /**
   * Office briefs are binary containers — reading them in the browser put raw
   * ZIP bytes ("PK…[Content_Types].xml") in the textarea. Extraction runs on
   * the server through the same parser as the Campaign Brief upload flow.
   */
  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    startExtracting(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await extractBriefFileTextAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.text.length < MIN_BRIEF_CHARS) {
        toast.error("That file looks too short — use a fuller campaign brief.");
        return;
      }
      setBriefText(result.text);
      toast.success(`Loaded ${result.fileName}`);
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-[min(100vw-2rem,640px)] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-4 py-3 sm:px-6">
          <DialogTitle>Campaign brief</DialogTitle>
          <DialogDescription>
            Paste or write the client brief — objective, audience, launch timing, peaks, deliverables…
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          <textarea
            value={briefText}
            onChange={(event) => setBriefText(event.target.value)}
            rows={12}
            placeholder="Paste or write the client brief — objective, audience, launch timing, peaks, deliverables…"
            className={cn(
              "min-h-[14rem] w-full resize-y rounded-lg border border-border/70 bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]/40"
            )}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border/70 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
              <input
                type="file"
                accept=".txt,.md,.rtf,.doc,.docx,.pdf,.pptx"
                className="sr-only"
                onChange={onFileChange}
                disabled={extracting}
              />
              {extracting ? (
                <Loader2Icon className="size-3 animate-spin" aria-hidden />
              ) : null}
              {extracting ? "Reading file…" : "Upload brief file"}
            </label>
            <p className="text-[11px] text-muted-foreground">
              PDF, Word, PowerPoint, TXT, MD or RTF. Minimum 40 characters. Saving merges strategy — creators on the slate are never cleared.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!canSave || pending}
            onClick={saveBrief}
            className="bg-[#1D9E75] text-white hover:bg-[#178a66]"
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save brief
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
