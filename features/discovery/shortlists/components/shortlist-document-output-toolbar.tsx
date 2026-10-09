"use client";

import { useCallback, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

import {
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
  const [chooserOpen, setChooserOpen] = useState(false);
  const [format, setFormat] = useState("pdf");
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
    setChooserOpen(false);
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
      <ShortlistToolbarButton disabled={busy} onClick={() => setChooserOpen(true)}>Preview · {SHORTLIST_TEMPLATE_OPTIONS.find(t => t.id === exportTemplate)?.label}</ShortlistToolbarButton>
      <ShortlistToolbarButton disabled={busy} onClick={() => setChooserOpen(true)}>Export</ShortlistToolbarButton>
      <ShortlistToolbarButton disabled={busy || linkDisabled} onClick={onClientLink}>{clientLinkLabel}</ShortlistToolbarButton>
      <ShortlistToolbarButton variant="primary" disabled={busy || sendDisabled} onClick={onSend}>Send to client</ShortlistToolbarButton>
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="sl-redesign sl-dialog sl-output-dialog">
          <DialogHeader><DialogTitle>Preview &amp; export</DialogTitle><DialogDescription>Choose a layout, then select creators and platforms. Exported documents use your saved view settings.</DialogDescription></DialogHeader>
          <div className="sl-dialog-body"><div className="sl-lay">
            {SHORTLIST_TEMPLATE_OPTIONS.map(t => <label key={t.id}>
              <input type="radio" name="shortlist-layout" checked={exportTemplate === t.id} onChange={() => { onExportTemplateChange(t.id); if(t.id === "creator-list" && !["pdf", "html"].includes(format)) setFormat("pdf"); }} />
              <div className={"sl-lay__p sl-layout-" + t.id} aria-hidden>{[0,1,2].map(i => <s key={i} style={{ left: 8 + i * 31 + "%", top: t.id.includes("pitch") || t.id.includes("showcase") || t.id === "creator-list" ? "12%" : 18 + i * 20 + "%", width: t.id.includes("pitch") || t.id.includes("showcase") || t.id === "creator-list" ? "24%" : "80%", height: t.id.includes("pitch") || t.id.includes("showcase") || t.id === "creator-list" ? "72%" : "9%", ...(t.id === "detailed" || t.id === "lump-sum" ? {left:"8%"} : {}) }} />)}</div>
              <b>{t.label}</b><u>{t.hint}</u><div className="sl-lay__f">{(t.id === "creator-list" ? ["HTML","PDF"] : ["PDF","PPTX","DOCX","XLSX","CSV","HTML"]).map(f => <span className="sl-fmt" key={f}>{f}</span>)}</div>
            </label>)}
          </div><p className="sl-output-hint">Creator list supports HTML and PDF only. Choose creators and platforms in the next step.</p></div>
          <DialogFooter><button className="q-b" onClick={() => setChooserOpen(false)}>Cancel</button><span className="q-sp" />
            <select className="q-sel" aria-label="Export format" value={format} onChange={e => setFormat(e.target.value)}>{SHORTLIST_DOCUMENT_OUTPUT_FORMATS.filter(f => exportTemplate !== "creator-list" || ["pdf","html"].includes(f.id)).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
            <button className="q-b" disabled={!creators.length || busy} onClick={() => openSelection({type:"export",format,template:exportTemplate})}>Export</button>
            <button className="q-b q-b--pri" disabled={!creators.length || busy} onClick={() => openSelection({type:"preview",template:exportTemplate})}>Open preview</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
