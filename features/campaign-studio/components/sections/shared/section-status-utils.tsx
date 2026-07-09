"use client";

import type { CampaignStudioSectionStatus } from "../../../types/campaign-studio";
import { stripInternalSearchMetadata } from "./format-utils";

export function shouldShowPendingPlaceholder(
  status: CampaignStudioSectionStatus,
  hasStructuredData: boolean
): boolean {
  if (hasStructuredData) return false;
  if (status === "complete" || status === "blocked") return false;
  return status === "pending" || status === "running";
}

export function SectionFallbackContent({ text }: { text: string }) {
  const cleaned = stripInternalSearchMetadata(text);
  if (!cleaned.trim()) return null;

  return (
    <div className="min-w-0 space-y-1.5 break-words whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
      {cleaned.split(/\n\n+/).map((paragraph, index) => (
        <p key={index} className="min-w-0 break-words">{paragraph}</p>
      ))}
    </div>
  );
}

export function SectionPendingMessage({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground italic">{label}</p>;
}
