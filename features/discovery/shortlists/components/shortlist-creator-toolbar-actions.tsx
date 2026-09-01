"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
} from "lucide-react";

import { DocumentCreatorSelectionDialog } from "@/features/discovery/document-preview/document-creator-selection-dialog";
import { buildShortlistCreatorOptions } from "@/features/discovery/document-preview/build-creator-options";
import type { DocumentExportSelection } from "@/features/discovery/document-preview/document-export-selection";
import { triggerBrowserDownload } from "@/features/discovery/document-preview/document-export-selection";
import { summarizeShortlistSelection } from "@/features/discovery/document-preview/document-selection-summary";
import { buildShortlistExportHref } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import { shortlistPreviewPath } from "@/features/discovery/shortlists/constants";
import {
  SHORTLIST_TEMPLATE_OPTIONS,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";

export type ShortlistDocumentActionProps = {
  shortlistId: string;
  creators: ShortlistCreatorItem[];
  exportTemplate: ShortlistTemplateVariant;
  onExportTemplateChange: (template: ShortlistTemplateVariant) => void;
  selectedItemIds: string[];
  onSelectedItemIdsChange: (itemIds: string[]) => void;
  exportRevision?: string | null;
  busy?: boolean;
};

export const SHORTLIST_EXPORT_FORMATS = [
  { format: "html" as const, label: "HTML", icon: FileTextIcon },
  { format: "pdf" as const, label: "PDF", icon: DownloadIcon },
  { format: "excel" as const, label: "Excel", icon: FileSpreadsheetIcon },
  { format: "pptx" as const, label: "PPTX", icon: PresentationIcon },
  { format: "csv" as const, label: "CSV", icon: DownloadIcon },
  { format: "word" as const, label: "Word", icon: FileTextIcon },
];

type PendingAction =
  | { type: "preview"; template: ShortlistTemplateVariant }
  | {
      type: "export";
      format: (typeof SHORTLIST_EXPORT_FORMATS)[number]["format"];
      template: ShortlistTemplateVariant;
    };

export function useShortlistDocumentActions({
  shortlistId,
  creators,
  exportTemplate,
  onExportTemplateChange,
  selectedItemIds,
  onSelectedItemIdsChange,
  exportRevision,
}: ShortlistDocumentActionProps) {
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

  function openSelection(action: PendingAction) {
    setPending(action);
    setSelectionOpen(true);
  }

  function openPreview(template: ShortlistTemplateVariant) {
    onExportTemplateChange(template);
    openSelection({ type: "preview", template });
  }

  function openExport(format: (typeof SHORTLIST_EXPORT_FORMATS)[number]["format"]) {
    openSelection({ type: "export", format, template: exportTemplate });
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

  return {
    selectionOpen,
    setSelectionOpen,
    pending,
    creatorOptions,
    summarizeSelection,
    handleConfirm,
    openPreview,
    openExport,
    dialog: (
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
    ),
  };
}
