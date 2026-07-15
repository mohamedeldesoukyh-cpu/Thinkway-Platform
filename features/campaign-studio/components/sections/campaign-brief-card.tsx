"use client";

import { useCallback, useState, useTransition } from "react";
import { FileTextIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { hasCampaignBriefText } from "@/features/campaign-outputs/brief-media-plan-schedule";

import { applyCampaignBriefAction } from "../../actions/campaign-brief-actions";

type CampaignBriefCardProps = {
  campaignObject?: CampaignObject;
  conversationId?: string;
  messageId?: string;
  onBriefApplied?: (campaignObject: Record<string, unknown>) => void;
  className?: string;
};

export function CampaignBriefCard({
  campaignObject,
  conversationId,
  messageId,
  onBriefApplied,
  className,
}: CampaignBriefCardProps) {
  const facts = campaignObject ? getCampaignFacts(campaignObject) : undefined;
  const existingBrief =
    facts?.rawBriefExcerpt?.trim() ||
    (typeof campaignObject?.sections.summary?.content === "string"
      ? campaignObject.sections.summary.content.trim()
      : "");

  const [briefText, setBriefText] = useState(existingBrief);
  const [pending, startTransition] = useTransition();

  const canSave = Boolean(conversationId && messageId && briefText.trim().length >= 40);
  const hasBrief = campaignObject ? hasCampaignBriefText(campaignObject) : false;

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
        if (result.campaignObject) onBriefApplied?.(result.campaignObject);
      } else {
        toast.error(result.message);
      }
    });
  }, [briefText, canSave, conversationId, messageId, onBriefApplied]);

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result.trim() : "";
        if (text.length >= 40) {
          setBriefText(text);
        } else {
          toast.error("That file looks too short — use a fuller campaign brief.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    []
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-muted/10 p-3",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FileTextIcon className="size-3.5 text-[#1D9E75]" />
          <p className="text-[11px] font-bold text-foreground">Campaign brief</p>
        </div>
        {hasBrief ? (
          <span className="rounded-full bg-[#1D9E75]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1D9E75]">
            Active
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Optional — drives scheduling strategy</span>
        )}
      </div>

      <textarea
        value={briefText}
        onChange={(event) => setBriefText(event.target.value)}
        rows={5}
        placeholder="Paste or write the client brief — objective, audience, launch timing, peaks, deliverables…"
        className={cn(
          "min-h-[7rem] w-full resize-y rounded-lg border border-border/70 bg-background px-3 py-2 text-[12px] leading-relaxed text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]/40"
        )}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
          <input type="file" accept=".txt,.md,.doc,.docx" className="sr-only" onChange={onFileChange} />
          Upload text file
        </label>
        <button
          type="button"
          disabled={!canSave || pending}
          onClick={saveBrief}
          className="inline-flex items-center gap-1 rounded-md bg-[#1D9E75] px-2.5 py-1 text-[10px] font-bold text-white transition-colors hover:bg-[#178a66] disabled:opacity-40"
        >
          {pending ? <Loader2Icon className="size-3 animate-spin" /> : null}
          Save brief
        </button>
        <p className="text-[10px] text-muted-foreground">
          Saving merges strategy into this campaign — creators on the slate are never cleared.
        </p>
      </div>
    </div>
  );
}
