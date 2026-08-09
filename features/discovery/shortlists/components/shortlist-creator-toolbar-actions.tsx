"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
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
import { DocumentCreatorSelectionDialog } from "@/features/discovery/document-preview/document-creator-selection-dialog";
import { buildShortlistCreatorOptions } from "@/features/discovery/document-preview/build-creator-options";
import type { DocumentExportSelection } from "@/features/discovery/document-preview/document-export-selection";
import { triggerBrowserDownload } from "@/features/discovery/document-preview/document-export-selection";
import { summarizeShortlistSelection } from "@/features/discovery/document-preview/document-selection-summary";
import { buildShortlistExportHref } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import { shortlistPreviewPath } from "@/features/discovery/shortlists/constants";
import {
  SHORTLIST_TEMPLATE_OPTIONS,
  isCreatorDeckTemplate,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";

type Props = {
  shortlistId: string;
  creators: ShortlistCreatorItem[];
  exportTemplate: ShortlistTemplateVariant;
  onExportTemplateChange: (template: ShortlistTemplateVariant) => void;
  selectedItemIds: string[];
  onSelectedItemIdsChange: (itemIds: string[]) => void;
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

type PendingAction =
  | { type: "preview"; template: ShortlistTemplateVariant }
  | { type: "export"; format: (typeof EXPORT_FORMATS)[number]["format"]; template: ShortlistTemplateVariant };

export function ShortlistCreatorToolbarActions({
  shortlistId,
  creators,
  exportTemplate,
  onExportTemplateChange,
  selectedItemIds,
  onSelectedItemIdsChange,
  exportRevision,
  busy,
}: Props) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const creatorOptions = useMemo(
    () => buildShortlistCreatorOptions(creators),
    [creators]
  );

  const summarizeSelection = useCallback(
    (itemIds: string[]) => summarizeShortlistSelection(creators, itemIds),
    [creators]
  );

  const activeTemplate =
    SHORTLIST_TEMPLATE_OPTIONS.find((option) => option.id === exportTemplate) ??
    SHORTLIST_TEMPLATE_OPTIONS[0];

  function openSelection(action: PendingAction) {
    setPending(action);
    setSelectionOpen(true);
  }

  function handleConfirm(selection: DocumentExportSelection) {
    if (!pending) return;
    const ids = selection.itemIds.length > 0 ? selection.itemIds : undefined;
    const platforms = selection.platforms?.length ? selection.platforms : undefined;

    if (pending.type === "preview") {
      const href = shortlistPreviewPath(shortlistId, {
        template: pending.template,
        itemIds: ids,
        platforms,
      });
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    const href = buildShortlistExportHref(shortlistId, pending.format, pending.template, {
      itemIds: ids,
      platforms,
      exportRevision,
    });
    triggerBrowserDownload(href);
  }

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
        <DropdownMenuContent align="end" className="min-w-[180px] w-[180px]">
          {EXPORT_FORMATS.filter(
            (entry) => !entry.deckOnly || isCreatorDeckTemplate(exportTemplate)
          ).map(({ format, label, icon: Icon }) => (
            <DropdownMenuItem
              key={format}
              onSelect={(event) => {
                event.preventDefault();
                openSelection({ type: "export", format, template: exportTemplate });
              }}
              className="flex cursor-pointer items-center gap-2"
            >
              <Icon className="size-3.5" />
              {label}
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
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openSelection({ type: "preview", template: exportTemplate });
            }}
            className="flex items-center justify-between gap-2"
          >
            <span>Choose creators &amp; open preview</span>
            <EyeIcon className="size-3.5 text-[var(--text-3)]" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DocumentCreatorSelectionDialog
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        creators={creatorOptions}
        workspaceItemIds={selectedItemIds}
        onWorkspaceSelectionChange={onSelectedItemIdsChange}
        summarizeSelection={summarizeSelection}
        title="Select creators for shortlist"
        confirmLabel={pending?.type === "export" ? "Export" : "Open preview"}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
