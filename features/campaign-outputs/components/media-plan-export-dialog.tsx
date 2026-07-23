"use client";

import { useCallback, useState, type ReactNode } from "react";
import { DownloadIcon, FileCodeIcon, FileSpreadsheetIcon, PresentationIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { MediaPlanExportFormat } from "./media-plan-export-actions";
import { buildMediaPlanExportHref } from "./media-plan-export-actions";
import type {
  InfluencerConceptsExportLevel,
  MediaPlanExportLanguage,
  MediaPlanPresentationMode,
} from "../media-plan-presentation";
import { DOCUMENT_PREVIEW_DIALOG_Z } from "./document-preview-window";

/** Dialog choice — Calendar and Deliverables maps to standard layout without pricing. */
export type MediaPlanExportTypeChoice =
  | MediaPlanPresentationMode
  | "calendar_deliverables";

const EXPORT_TYPE_OPTIONS: Array<{
  id: MediaPlanExportTypeChoice;
  label: string;
  description: string;
}> = [
  {
    id: "standard",
    label: "Standard",
    description: "Summary sections + 3–4 creative recommendations",
  },
  {
    id: "strategy",
    label: "Strategy",
    description: "Full strategy + intelligence blocks",
  },
  {
    id: "calendar_deliverables",
    label: "Calendar and Deliverables",
    description: "Same as Standard, without client pricing",
  },
];

const FORMAT_OPTIONS: Array<{
  format: MediaPlanExportFormat;
  label: string;
  icon: typeof DownloadIcon;
  className?: string;
}> = [
  {
    format: "pdf",
    label: "PDF",
    icon: DownloadIcon,
    className: "border-[#0057FF]/25 bg-[#0057FF]/5 text-[#0057FF]",
  },
  {
    format: "pptx",
    label: "PowerPoint",
    icon: PresentationIcon,
    className: "border-[#B7472A]/25 text-[#B7472A]",
  },
  { format: "excel", label: "Excel", icon: FileSpreadsheetIcon },
  { format: "html", label: "HTML", icon: FileCodeIcon },
];

export function buildMediaPlanExportHrefWithOptions(
  campaignObjectId: string,
  format: MediaPlanExportFormat,
  options: {
    conversationId?: string;
    exportMode?: MediaPlanPresentationMode;
    conceptsExport?: InfluencerConceptsExportLevel;
    view?: "client" | "internal";
    exportLanguage?: MediaPlanExportLanguage;
    includeProductionSchedule?: boolean;
    includeInternalNotes?: boolean;
    includeCampaignCost?: boolean;
  }
): string {
  const params = new URLSearchParams({
    kind: "media_plan",
    format,
    download: "1",
  });
  if (options.conversationId) params.set("conversationId", options.conversationId);
  if (options.exportMode) params.set("exportMode", options.exportMode);
  if (options.conceptsExport) params.set("conceptsExport", options.conceptsExport);
  if (options.view) params.set("view", options.view);
  if (options.exportLanguage) params.set("exportLanguage", options.exportLanguage);
  if (options.includeProductionSchedule === false) params.set("productionSchedule", "0");
  if (options.includeInternalNotes) params.set("internalNotes", "1");
  if (options.includeCampaignCost === false) params.set("includeCost", "0");
  return `/api/ai/campaign-objects/${campaignObjectId}/outputs/export?${params.toString()}`;
}

/** Export dialog — Standard/Strategy, concepts level, schedule, language, internal notes. */
export function MediaPlanExportDialog({
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
  const [open, setOpen] = useState(false);
  const [exportType, setExportType] = useState<MediaPlanExportTypeChoice>("standard");
  const [conceptsExport, setConceptsExport] = useState<InfluencerConceptsExportLevel>("summary");
  const [exportLanguage, setExportLanguage] = useState<MediaPlanExportLanguage>("en");
  const [includeProductionSchedule, setIncludeProductionSchedule] = useState(true);
  const [includeInternalNotes, setIncludeInternalNotes] = useState(false);

  const presentationMode: MediaPlanPresentationMode =
    exportType === "strategy" ? "strategy" : "standard";
  const includeCampaignCost = exportType !== "calendar_deliverables";

  const buildHref = useCallback(
    (format: MediaPlanExportFormat) =>
      buildMediaPlanExportHrefWithOptions(campaignObjectId, format, {
        conversationId,
        exportMode: presentationMode,
        conceptsExport: presentationMode === "strategy" ? conceptsExport : "summary",
        view: includeInternalNotes ? "internal" : "client",
        exportLanguage,
        includeProductionSchedule:
          presentationMode === "strategy" ? includeProductionSchedule : true,
        includeInternalNotes: presentationMode === "strategy" && includeInternalNotes,
        includeCampaignCost,
      }),
    [
      campaignObjectId,
      conversationId,
      presentationMode,
      conceptsExport,
      exportLanguage,
      includeProductionSchedule,
      includeInternalNotes,
      includeCampaignCost,
    ]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("h-7 gap-1.5 text-[11px] font-semibold", className)}
        >
          <DownloadIcon className="size-3.5" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent
        className="z-[9999] sm:max-w-2xl"
        overlayClassName="z-[9999]"
        style={{ zIndex: DOCUMENT_PREVIEW_DIALOG_Z }}
      >
        <DialogHeader>
          <DialogTitle>Export Media Plan</DialogTitle>
          <DialogDescription>
            Choose export type and format. Client exports hide AI rationale and confidence labels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-foreground">Export type</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {EXPORT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setExportType(option.id)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-[11px] transition-colors",
                    exportType === option.id
                      ? "border-[#1D9E75] bg-[#1D9E75]/10 font-semibold text-[#1D9E75]"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="block">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {exportType === "strategy" ? (
            <>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-foreground">Influencer concepts</legend>
                <div className="flex flex-wrap gap-2">
                  {(["summary", "full", "none"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setConceptsExport(level)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-[10px] font-semibold capitalize transition-colors",
                        conceptsExport === level
                          ? "border-[#0057FF] bg-[#0057FF]/10 text-[#0057FF]"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-foreground">Language</legend>
                <div className="flex flex-wrap gap-2">
                  {(["en", "ar", "bilingual"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setExportLanguage(lang)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-[10px] font-semibold capitalize transition-colors",
                        exportLanguage === lang
                          ? "border-[#0057FF] bg-[#0057FF]/10 text-[#0057FF]"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      {lang === "en" ? "English" : lang === "ar" ? "Arabic" : "Bilingual"}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-foreground">Include</legend>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={includeProductionSchedule}
                      onChange={(event) => setIncludeProductionSchedule(event.target.checked)}
                      className="rounded border-border"
                    />
                    Production schedule
                  </label>
                  <label className="flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={includeInternalNotes}
                      onChange={(event) => setIncludeInternalNotes(event.target.checked)}
                      className="rounded border-border"
                    />
                    Internal notes & AI rationale (internal view)
                  </label>
                </div>
              </fieldset>
            </>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="grid w-full grid-cols-2 gap-2">
            {FORMAT_OPTIONS.map(({ format, label, icon: Icon, className: btnClass }) => (
              <a
                key={format}
                href={buildHref(format)}
                onClick={() => setOpen(false)}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-muted/60",
                  btnClass
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </a>
            ))}
          </div>
          <p className="w-full text-center text-[10px] text-muted-foreground">
            Excel export uses calendar data only — presentation options apply to PDF, PPT, and HTML.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Re-export for backward compatibility — quick export without dialog. */
export { buildMediaPlanExportHref };

/** MVP presentation mode shell — fullscreen section navigation over preview. */
export function MediaPlanPresentationShell({
  open,
  onOpenChange,
  sections,
  activeSection,
  onSectionSelect,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: Array<{ id: string; label: string }>;
  activeSection: string;
  onSectionSelect: (id: string) => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex bg-[#060810]/95">
      <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-white/10 p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Sections</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Exit presentation"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionSelect(section.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-[12px] font-semibold transition-colors",
              activeSection === section.id
                ? "bg-[#0057FF] text-white"
                : "text-white/75 hover:bg-white/10 hover:text-white"
            )}
          >
            {section.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
