"use client";

import Link from "next/link";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buildShortlistExportHref } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import { shortlistPreviewPath } from "@/features/discovery/shortlists/constants";
import {
  SHORTLIST_TEMPLATE_OPTIONS,
  isCreatorDeckTemplate,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";

type Props = {
  shortlistId: string;
  exportTemplate: ShortlistTemplateVariant;
  onExportTemplateChange: (template: ShortlistTemplateVariant) => void;
  selectedItemIds: string[];
  exportRevision?: string | null;
  busy?: boolean;
};

const EXPORT_FORMATS = [
  { format: "html" as const, label: "HTML", icon: FileTextIcon },
  { format: "pdf" as const, label: "PDF", icon: DownloadIcon },
  { format: "excel" as const, label: "Excel", icon: FileSpreadsheetIcon },
  { format: "pptx" as const, label: "PPTX", icon: PresentationIcon, deckOnly: true },
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
}: Props) {
  const itemIds = selectedItemIds.length > 0 ? selectedItemIds : undefined;
  const previewHref = shortlistPreviewPath(shortlistId, {
    template: exportTemplate,
    itemIds,
  });
  const exportOptions = { itemIds, exportRevision };
  const activeTemplate =
    SHORTLIST_TEMPLATE_OPTIONS.find((option) => option.id === exportTemplate) ??
    SHORTLIST_TEMPLATE_OPTIONS[0];

  return (
    <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Export"
              title="Export"
              disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] border border-border bg-background text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <DownloadIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {EXPORT_FORMATS.filter(
              (entry) => !entry.deckOnly || isCreatorDeckTemplate(exportTemplate)
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-8 items-center gap-2 rounded-[9px] border border-border bg-background px-3 text-[12.5px] font-semibold text-[var(--text-2)] transition-all hover:bg-muted/30 active:scale-[0.975] disabled:opacity-50"
            >
              <EyeIcon className="size-[15px] text-muted-foreground" />
              Preview
              <span className="inline-flex h-5 items-center rounded-md bg-muted/50 px-[7px] text-[11px] font-semibold text-[var(--text-3)]">
                {activeTemplate.label}
              </span>
              <ChevronDownIcon className="size-[13px] text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-3)]">
              Template
            </DropdownMenuLabel>
            {SHORTLIST_TEMPLATE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onSelect={() => onExportTemplateChange(option.id)}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[13px] font-medium text-[var(--text-2)]",
                      exportTemplate === option.id && "font-semibold text-[var(--text)]"
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-[var(--text-3)]">{option.hint}</span>
                </span>
                <CheckIcon
                  className={cn(
                    "size-3.5 shrink-0 text-primary",
                    exportTemplate === option.id ? "opacity-100" : "opacity-0"
                  )}
                />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={previewHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2"
              >
                <span>Open preview</span>
                <ExternalLinkIcon className="size-3.5 text-[var(--text-3)]" />
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
    </div>
  );
}
