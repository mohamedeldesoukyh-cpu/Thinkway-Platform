"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DocumentOutputToolbar,
  type DocumentOutputFormatOption,
} from "@/features/discovery/document-output/document-output-toolbar";
import { DocumentCreatorSelectionDialog } from "@/features/discovery/document-preview/document-creator-selection-dialog";
import { buildShortlistCreatorOptions } from "@/features/discovery/document-preview/build-creator-options";
import type { DocumentExportSelection } from "@/features/discovery/document-preview/document-export-selection";
import { triggerBrowserDownload } from "@/features/discovery/document-preview/document-export-selection";
import { summarizeShortlistSelection } from "@/features/discovery/document-preview/document-selection-summary";
import { buildShortlistExportHref } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import {
  ShortlistToolbarButton,
} from "@/features/discovery/shortlists/components/shortlist-detail-primitives";
import { shortlistPreviewPath } from "@/features/discovery/shortlists/constants";
import {
  SHORTLIST_TEMPLATE_OPTIONS,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";

/** Capability list for shortlist — includes CSV (quotation adapter omits it). */
export const SHORTLIST_DOCUMENT_OUTPUT_FORMATS: DocumentOutputFormatOption[] = [
  { id: "pdf", label: "PDF", purpose: "Send to a client — fixed layout", kind: "doc" },
  { id: "pptx", label: "PowerPoint", purpose: "Present or edit the deck", kind: "doc" },
  { id: "word", label: "Word", purpose: "Edit the wording before sending", kind: "doc" },
  { id: "excel", label: "Excel", purpose: "Work with the numbers", kind: "sheet" },
  { id: "csv", label: "CSV", purpose: "Feed another system", kind: "sheet" },
  { id: "html", label: "HTML", purpose: "Open in a browser, no download", kind: "web" },
];

type PendingAction =
  | { type: "preview"; template: ShortlistTemplateVariant }
  | {
      type: "export";
      format: string;
      template: ShortlistTemplateVariant;
    };

type Props = {
  shortlistId: string;
  creators: ShortlistCreatorItem[];
  exportTemplate: ShortlistTemplateVariant;
  onExportTemplateChange: (template: ShortlistTemplateVariant) => void;
  selectedItemIds: string[];
  onSelectedItemIdsChange: (itemIds: string[]) => void;
  exportRevision?: string | null;
  busy?: boolean;
  onClientLink: () => void;
  onSend: () => void;
  clientLinkLabel?: string;
  linkDisabled?: boolean;
  sendDisabled?: boolean;
};

/**
 * Page-2 Overlay F adapter — shared DocumentOutputToolbar + shortlist selection/download.
 */
export function ShortlistDocumentOutputToolbar({
  shortlistId,
  creators,
  exportTemplate,
  onExportTemplateChange,
  selectedItemIds,
  onSelectedItemIdsChange,
  exportRevision,
  busy,
  onClientLink,
  onSend,
  clientLinkLabel = "Client link",
  linkDisabled,
  sendDisabled,
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

  function openSelection(action: PendingAction) {
    if (creators.length === 0) {
      toast.error("Add creators before previewing or exporting.");
      return;
    }
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
    <>
      <DocumentOutputToolbar
        templates={SHORTLIST_TEMPLATE_OPTIONS}
        activeTemplateId={exportTemplate}
        onTemplateChange={(id) => onExportTemplateChange(id as ShortlistTemplateVariant)}
        onOpenPreview={() => openSelection({ type: "preview", template: exportTemplate })}
        formats={SHORTLIST_DOCUMENT_OUTPUT_FORMATS}
        onExport={(formatId) =>
          openSelection({ type: "export", format: formatId, template: exportTemplate })
        }
        onClientLink={onClientLink}
        onSend={onSend}
        clientLinkLabel={clientLinkLabel}
        busy={busy}
        linkDisabled={linkDisabled}
        sendDisabled={sendDisabled}
        renderTrigger={({ children, disabled, primary, onClick }) => (
          <ShortlistToolbarButton
            variant={primary ? "glow" : "outline"}
            size="sm"
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </ShortlistToolbarButton>
        )}
      />

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
    </>
  );
}
