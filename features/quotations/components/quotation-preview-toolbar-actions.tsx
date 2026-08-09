"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DocumentCreatorSelectionDialog } from "@/features/discovery/document-preview/document-creator-selection-dialog";
import {
  buildQuotationCreatorOptions,
  enrichQuotationCreatorOptionsWithLinkedPlatforms,
} from "@/features/discovery/document-preview/build-creator-options";
import type { DocumentExportSelection } from "@/features/discovery/document-preview/document-export-selection";
import {
  appendPlatformsQueryParam,
  triggerBrowserDownload,
} from "@/features/discovery/document-preview/document-export-selection";
import { summarizeQuotationSelection } from "@/features/discovery/document-preview/document-selection-summary";
import { buildExportHref } from "@/features/quotations/components/quotation-preview-downloads";
import { QuotationToolbarButton } from "@/features/quotations/components/quotation-detail-primitives";
import { quotationPreviewPath } from "@/features/quotations/constants";
import {
  QUOTATION_TEMPLATE_OPTIONS,
  appendQuotationExportRevision,
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";
import type { QuotationItemRow } from "@/features/quotations/types";
import { cn } from "@/lib/utils";

type Props = {
  quotationId: string;
  serialNumber?: string | null;
  items: QuotationItemRow[];
  currency?: string | null;
  exportTemplate: QuotationTemplateVariant;
  onExportTemplateChange: (template: QuotationTemplateVariant) => void;
  selectedItemIds?: string[];
  onSelectedItemIdsChange?: (itemIds: string[]) => void;
  exportRevision?: string | null;
  busy?: boolean;
};

const EXPORT_FORMATS = [
  { format: "excel" as const, label: "Excel", icon: FileSpreadsheetIcon },
  { format: "word" as const, label: "Word", icon: FileTextIcon },
  { format: "pdf" as const, label: "PDF", icon: DownloadIcon },
  { format: "pptx" as const, label: "PPTX", icon: PresentationIcon },
];

type PendingAction =
  | { type: "preview"; template: QuotationTemplateVariant }
  | { type: "export"; format: (typeof EXPORT_FORMATS)[number]["format"]; template: QuotationTemplateVariant };

function quotationPreviewHref(
  quotationId: string,
  serialNumber: string | null | undefined,
  template: QuotationTemplateVariant,
  options?: {
    exportRevision?: string | null;
    itemIds?: string[];
    platforms?: string[] | null;
  }
): string {
  const params = new URLSearchParams();
  appendQuotationTemplateParam(params, template);
  appendQuotationExportRevision(params, options?.exportRevision);
  if (options?.itemIds?.length) {
    params.set("items", options.itemIds.join(","));
  }
  appendPlatformsQueryParam(params, options?.platforms);
  const query = params.toString();
  return quotationPreviewPath(quotationId, serialNumber, query || undefined);
}

export function QuotationPreviewToolbarActions({
  quotationId,
  serialNumber,
  items,
  currency,
  exportTemplate,
  onExportTemplateChange,
  selectedItemIds,
  onSelectedItemIdsChange,
  exportRevision,
  busy,
}: Props) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const baseCreatorOptions = useMemo(
    () => buildQuotationCreatorOptions(items),
    [items]
  );
  const [creatorOptions, setCreatorOptions] = useState(baseCreatorOptions);

  useEffect(() => {
    setCreatorOptions(baseCreatorOptions);
  }, [baseCreatorOptions]);

  useEffect(() => {
    if (!selectionOpen) return;
    let cancelled = false;
    void enrichQuotationCreatorOptionsWithLinkedPlatforms(items, baseCreatorOptions).then(
      (enriched) => {
        if (!cancelled) setCreatorOptions(enriched);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectionOpen, items, baseCreatorOptions]);

  const summarizeSelection = useCallback(
    (itemIds: string[]) => summarizeQuotationSelection(items, itemIds, currency ?? "EGP"),
    [items, currency]
  );

  const activeTemplate =
    QUOTATION_TEMPLATE_OPTIONS.find((option) => option.id === exportTemplate) ??
    QUOTATION_TEMPLATE_OPTIONS[0];

  function openSelection(action: PendingAction) {
    setPending(action);
    setSelectionOpen(true);
  }

  function handleConfirm(selection: DocumentExportSelection) {
    if (!pending) return;
    const ids = selection.itemIds.length > 0 ? selection.itemIds : undefined;
    const platforms = selection.platforms?.length ? selection.platforms : undefined;

    if (pending.type === "preview") {
      const href = quotationPreviewHref(quotationId, serialNumber, pending.template, {
        exportRevision,
        itemIds: ids,
        platforms,
      });
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    const href = buildExportHref(quotationId, pending.format, pending.template, {
      download: true,
      exportRevision,
      itemIds: ids,
      platforms,
    });
    triggerBrowserDownload(href);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <QuotationToolbarButton variant="outline" size="sm" disabled={busy} className="btn">
            <EyeIcon className="size-3.5" />
            Preview
            <span className="spill spill-compact">{activeTemplate.label}</span>
            <ChevronDownIcon className="size-3 text-[var(--text-4)]" />
          </QuotationToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px]">
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Template
          </DropdownMenuLabel>
          {QUOTATION_TEMPLATE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => onExportTemplateChange(option.id)}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-[13px] font-medium",
                    exportTemplate === option.id && "font-semibold text-foreground"
                  )}
                >
                  {option.label}
                </span>
                <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
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
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Export
          </DropdownMenuLabel>
          {EXPORT_FORMATS.map(({ format, label, icon: Icon }) => (
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openSelection({ type: "preview", template: exportTemplate });
            }}
            className="flex items-center justify-between gap-2"
          >
            <span>Choose creators &amp; platforms</span>
            <EyeIcon className="size-3.5 text-muted-foreground" />
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
        title="Select creators for quotation"
        confirmLabel={pending?.type === "export" ? "Export" : "Open preview"}
        onConfirm={handleConfirm}
      />
    </>
  );
}
