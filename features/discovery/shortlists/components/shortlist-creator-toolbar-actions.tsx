"use client";

import Link from "next/link";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
  RefreshCwIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buildShortlistExportHref } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import { shortlistPreviewPath } from "@/features/discovery/shortlists/constants";
import {
  SHORTLIST_TEMPLATE_OPTIONS,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";
import { ShortlistToolbarButton } from "./shortlist-detail-primitives";

type Props = {
  shortlistId: string;
  exportTemplate: ShortlistTemplateVariant;
  onExportTemplateChange: (template: ShortlistTemplateVariant) => void;
  selectedItemIds: string[];
  exportRevision?: string | null;
  busy?: boolean;
  onRefreshMetrics: () => void;
};

const EXPORT_FORMATS = [
  { format: "html" as const, label: "HTML", icon: FileTextIcon },
  { format: "pdf" as const, label: "PDF", icon: DownloadIcon },
  { format: "excel" as const, label: "Excel", icon: FileSpreadsheetIcon },
  { format: "pptx" as const, label: "PPTX", icon: PresentationIcon, showcaseOnly: true },
  { format: "csv" as const, label: "CSV", icon: DownloadIcon },
  { format: "word" as const, label: "Word", icon: FileTextIcon },
];

export function ShortlistCreatorToolbarActions({
  shortlistId,
  exportTemplate,
  onExportTemplateChange,
  selectedItemIds,
  exportRevision,
  busy,
  onRefreshMetrics,
}: Props) {
  const itemIds = selectedItemIds.length > 0 ? selectedItemIds : undefined;
  const previewHref = shortlistPreviewPath(shortlistId, {
    template: exportTemplate,
    itemIds,
  });
  const exportOptions = { itemIds, exportRevision };

  return (
    <>
      <ShortlistToolbarButton onClick={onRefreshMetrics} disabled={busy}>
        <RefreshCwIcon className={cn("size-3.5", busy && "animate-spin")} />
        {busy ? "Collecting metrics" : "Refresh metrics"}
      </ShortlistToolbarButton>

      <div
        className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
        role="tablist"
        aria-label="Export template"
      >
        {SHORTLIST_TEMPLATE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={exportTemplate === option.id}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              exportTemplate === option.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onExportTemplateChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Link
        href={previewHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-xs font-semibold text-muted-foreground transition-all hover:border-slate-300 hover:bg-muted/50 active:scale-[0.97]"
      >
        <FileTextIcon className="size-3.5" />
        Preview
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-xs font-semibold text-muted-foreground transition-all hover:border-slate-300 hover:bg-muted/50 active:scale-[0.97]"
          >
            <DownloadIcon className="size-3.5" />
            Export
            <ChevronDownIcon className="size-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {EXPORT_FORMATS.filter(
            (entry) => !entry.showcaseOnly || exportTemplate === "showcase"
          ).map(({ format, label, icon: Icon }) => (
            <DropdownMenuItem key={format} asChild>
              <a
                href={buildShortlistExportHref(shortlistId, format, exportTemplate, exportOptions)}
                className="flex cursor-pointer items-center gap-2"
              >
                <Icon className="size-3.5" />
                {label}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
