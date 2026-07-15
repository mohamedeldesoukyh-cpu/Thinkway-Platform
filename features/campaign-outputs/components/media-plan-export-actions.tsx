import { DownloadIcon, FileCodeIcon, FileSpreadsheetIcon, PresentationIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignOutputKind } from "../output-types";

export type MediaPlanExportFormat = "html" | "pdf" | "excel" | "pptx";

export function buildMediaPlanExportHref(
  campaignObjectId: string,
  format: MediaPlanExportFormat,
  options?: { conversationId?: string; download?: boolean; kind?: CampaignOutputKind }
) {
  const params = new URLSearchParams({
    kind: options?.kind ?? "media_plan",
    format,
  });
  if (options?.conversationId) {
    params.set("conversationId", options.conversationId);
  }
  if (options?.download !== false) {
    params.set("download", "1");
  }
  return `/api/ai/campaign-objects/${campaignObjectId}/outputs/export?${params.toString()}`;
}

const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-40";

/** PDF, PowerPoint, Excel, and HTML export for the Media Plan preview panel. */
export function MediaPlanExportActions({
  campaignObjectId,
  conversationId,
  disabled,
  className,
}: {
  campaignObjectId: string;
  conversationId?: string;
  disabled?: boolean;
  className?: string;
}) {
  const exportOptions = { conversationId, download: true as const };

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="group"
      aria-label="Export media plan"
    >
      <a
        href={buildMediaPlanExportHref(campaignObjectId, "pdf", exportOptions)}
        className={cn(BUTTON_CLASS, "border-[#0057FF]/25 bg-[#0057FF]/5 text-[#0057FF] hover:bg-[#0057FF]/10")}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onClick={disabled ? (event) => event.preventDefault() : undefined}
      >
        <DownloadIcon className="size-3.5" aria-hidden />
        PDF
      </a>
      <a
        href={buildMediaPlanExportHref(campaignObjectId, "pptx", exportOptions)}
        className={cn(
          BUTTON_CLASS,
          "border-[#B7472A]/25 bg-gradient-to-br from-[#B7472A]/10 to-[#D2571F]/10 text-[#B7472A] hover:from-[#B7472A]/15 hover:to-[#D2571F]/15"
        )}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onClick={disabled ? (event) => event.preventDefault() : undefined}
        aria-label="Download media plan as PowerPoint"
      >
        <PresentationIcon className="size-3.5" aria-hidden />
        PowerPoint
      </a>
      <a
        href={buildMediaPlanExportHref(campaignObjectId, "excel", exportOptions)}
        className={BUTTON_CLASS}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onClick={disabled ? (event) => event.preventDefault() : undefined}
      >
        <FileSpreadsheetIcon className="size-3.5" aria-hidden />
        Excel
      </a>
      <a
        href={buildMediaPlanExportHref(campaignObjectId, "html", exportOptions)}
        className={BUTTON_CLASS}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onClick={disabled ? (event) => event.preventDefault() : undefined}
      >
        <FileCodeIcon className="size-3.5" aria-hidden />
        HTML
      </a>
    </div>
  );
}
