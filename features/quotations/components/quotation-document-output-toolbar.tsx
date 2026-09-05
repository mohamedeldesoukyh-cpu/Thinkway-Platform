"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DocumentOutputToolbar,
  type DocumentOutputFormatOption,
} from "@/features/discovery/document-output/document-output-toolbar";
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
import { quotationPreviewPath } from "@/features/quotations/constants";
import {
  QUOTATION_TEMPLATE_OPTIONS,
  appendQuotationExportRevision,
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";
import type { QuotationItemRow } from "@/features/quotations/types";
import { cn } from "@/lib/utils";

const QUOTATION_EXPORT_FORMATS: DocumentOutputFormatOption[] = [
  // Capability list for quotation — CSV omitted (no export API). Shortlist adapter adds it.
  { id: "pdf", label: "PDF", purpose: "Send to a client — fixed layout", kind: "doc" },
  { id: "pptx", label: "PowerPoint", purpose: "Present or edit the deck", kind: "doc" },
  { id: "word", label: "Word", purpose: "Edit the wording before sending", kind: "doc" },
  { id: "excel", label: "Excel", purpose: "Work with the numbers", kind: "sheet" },
  { id: "html", label: "HTML", purpose: "Open in a browser, no download", kind: "web" },
];

type PendingAction =
  | { type: "preview"; template: QuotationTemplateVariant }
  | {
      type: "export";
      format: string;
      template: QuotationTemplateVariant;
    };

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
  onClientLink: () => void;
  onSend: () => void;
  clientLinkLabel: string;
  linkDisabled?: boolean;
  sendDisabled?: boolean;
  linkPending?: boolean;
};

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

/**
 * Page-4 Overlay F adapter — shared DocumentOutputToolbar + quotation preview/export selection.
 */
export function QuotationDocumentOutputToolbar({
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
  onClientLink,
  onSend,
  clientLinkLabel,
  linkDisabled,
  sendDisabled,
  linkPending,
}: Props) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [platformsLoading, setPlatformsLoading] = useState(false);

  const baseCreatorOptions = useMemo(
    () => buildQuotationCreatorOptions(items),
    [items]
  );
  const [creatorOptions, setCreatorOptions] = useState(baseCreatorOptions);

  useEffect(() => {
    setCreatorOptions(baseCreatorOptions);
  }, [baseCreatorOptions]);

  useEffect(() => {
    if (!selectionOpen) {
      setPlatformsLoading(false);
      return;
    }
    let cancelled = false;
    setPlatformsLoading(true);
    void enrichQuotationCreatorOptionsWithLinkedPlatforms(items, baseCreatorOptions).then(
      (enriched) => {
        if (cancelled) return;
        setCreatorOptions(enriched);
        setPlatformsLoading(false);
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
      <DocumentOutputToolbar
        templates={QUOTATION_TEMPLATE_OPTIONS}
        activeTemplateId={exportTemplate}
        onTemplateChange={(id) => onExportTemplateChange(id as QuotationTemplateVariant)}
        onOpenPreview={() => openSelection({ type: "preview", template: exportTemplate })}
        formats={QUOTATION_EXPORT_FORMATS}
        onExport={(formatId) =>
          openSelection({ type: "export", format: formatId, template: exportTemplate })
        }
        onClientLink={onClientLink}
        onSend={onSend}
        clientLinkLabel={clientLinkLabel}
        busy={busy || linkPending}
        linkDisabled={linkDisabled || linkPending}
        sendDisabled={sendDisabled}
        renderTrigger={({ children, disabled, primary, onClick }) => (
          <button
            type="button"
            disabled={disabled}
            className={cn("tw-b sm", primary && "pri")}
            onClick={onClick}
          >
            {children}
          </button>
        )}
      />

      <DocumentCreatorSelectionDialog
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        creators={creatorOptions}
        workspaceItemIds={selectedItemIds}
        onWorkspaceSelectionChange={onSelectedItemIdsChange}
        summarizeSelection={summarizeSelection}
        title="Select creators for quotation"
        confirmLabel={pending?.type === "export" ? "Export" : "Open preview"}
        confirmDisabled={platformsLoading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
