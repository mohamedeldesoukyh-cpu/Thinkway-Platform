"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, ListOrderedIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { QuotationItemRow } from "@/features/quotations/types";
import { moveCreator, quotationOrderCreators } from "@/lib/quotations/quotation-creator-order";
import { QuotationTemplatePhotoEditor } from "./quotation-template-photo-editor";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { setQuotationCreatorOrder } from "@/features/quotations/actions";
import styles from "@/features/discovery/document-preview/creator-dialog.module.css";

export function QuotationCreatorOrderDialog({ quotationId, items, savedOrder, savedPhotos, onSaved }: {
  quotationId: string; items: QuotationItemRow[]; savedOrder?: string[]; savedPhotos?: Record<string, string>; onSaved: (order: string[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creators, setCreators] = useState(() => quotationOrderCreators(items, savedOrder));
  const [automatic, setAutomatic] = useState(!savedOrder?.length);
  const [changed, setChanged] = useState(false);
  const [savingOrder, startTransition] = useTransition();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photos, setPhotos] = useState(savedPhotos ?? {});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const grips = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => setPhotos(savedPhotos ?? {}), [savedPhotos]);
  const pending = savingOrder || photoBusy;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function reposition(from: number, to: number) {
    if (pending || from < 0 || to < 0 || to >= creators.length || from === to) return;
    const creator = creators[from];
    setCreators(current => moveCreator(current, from, to));
    setAutomatic(false); setChanged(true);
    setMessage(`${creator.name} moved to position ${to + 1}. Save order to apply.`);
    requestAnimationFrame(() => grips.current.get(creator.key)?.focus());
  }
  function save() {
    const order = automatic ? [] : creators.flatMap(creator => creator.items.map(item => item.id));
    setError("");
    startTransition(async () => {
      try {
        const result = await setQuotationCreatorOrder({ quotationId, itemIds: order });
        if (!result.ok) { setError(result.message); return; }
        onSaved(order); setOpen(false); router.refresh();
        toast.success(automatic ? "Automatic creator order restored." : "Creator order saved.");
      } catch { setError("Could not save the order. Please try again."); }
    });
  }
  return <Dialog open={open} onOpenChange={next => {
    if (pending) return;
    if (next) {
      setCreators(quotationOrderCreators(items, savedOrder)); setAutomatic(!savedOrder?.length);
      setChanged(false); setMessage(""); setError(""); setDragId(null); setOverId(null);
    }
    setOpen(next);
  }}>
    <DialogTrigger asChild><button type="button" className="tw-b sm"><ListOrderedIcon size={16} /> Order creators</button></DialogTrigger>
    <DialogContent className={styles.dialog} overlayClassName={styles.overlay} showCloseButton={false}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div>
            <DialogTitle className={styles.title}>Order creators</DialogTitle>
            <DialogDescription className={styles.subtitle}>Drag to reorder. This order is used by the quotation, the Creator List, the Client List by Name and the linked client workspace. Each creator's options stay together.</DialogDescription>
          </div>
          <button type="button" className={styles.close} aria-label="Close order creators" disabled={pending} onClick={() => setOpen(false)}><XIcon size={16} aria-hidden="true" /></button>
        </div>
        <details className={styles.note}>
          <summary>About template photos</summary>
          <p>JPG, PNG or WebP up to 750 KB. Choose a photo, then Apply photo to save it immediately for this quotation's templates and linked client workspace. The main creator profile stays unchanged. Reset restores the profile photo. Order changes use Save order.</p>
        </details>
      </header>
      <div className={styles.body}>
        <ol className={styles.rows} aria-label="Creator order">
          {creators.map((creator, index) => <li key={creator.key} className={[styles.row, dragId === creator.key ? styles.dragging : "", overId === creator.key ? styles.over : ""].join(" ")}
            onDragOver={event => { if (dragId && !pending) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setOverId(creator.key === dragId ? null : creator.key); } }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverId(null); }}
            onDrop={event => {
              if (!dragId || pending) return;
              event.preventDefault(); reposition(creators.findIndex(row => row.key === dragId), index); setDragId(null); setOverId(null);
            }}>
            <span className={styles.position} aria-hidden="true">{index + 1}</span>
            <button type="button" className={styles.grip} ref={element => { if (element) grips.current.set(creator.key, element); else grips.current.delete(creator.key); }}
              aria-label={`Reorder ${creator.name}. Use Alt plus Up or Down, or the arrow buttons.`} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              disabled={pending} draggable={!pending}
              onDragStart={event => { setDragId(creator.key); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", creator.key); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onKeyDown={event => { if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); reposition(index, index + (event.key === "ArrowUp" ? -1 : 1)); } }}>
              <GripVerticalIcon size={18} aria-hidden="true" />
            </button>
            <QuotationTemplatePhotoEditor quotationId={quotationId} itemId={creator.items[0].id} name={creator.name} optionCount={creator.items.length}
              original={creatorAvatarBrowserDisplayUrl(creator.items[0].creator_profile_source?.avatarUrl || creator.items[0].profile_image_url, creator.items[0].profile_url)}
              current={photos[creator.key]} disabled={pending} onBusy={setPhotoBusy} onApplied={photo => {
                setPhotos(current => { const next = {...current}; if (photo) next[creator.key] = photo; else delete next[creator.key]; return next; });
                router.refresh();
              }} controls={<div className={styles.orderActions}>
                <button type="button" className={`${styles.button} ${styles.icon} ${styles.ghost}`} aria-label={`Move ${creator.name} up`} aria-disabled={pending || index === 0} onClick={() => reposition(index, index - 1)}><ArrowUpIcon size={16} aria-hidden="true" /></button>
                <button type="button" className={`${styles.button} ${styles.icon} ${styles.ghost}`} aria-label={`Move ${creator.name} down`} aria-disabled={pending || index === creators.length - 1} onClick={() => reposition(index, index + 1)}><ArrowDownIcon size={16} aria-hidden="true" /></button>
              </div>} />
          </li>)}
        </ol>
      </div>
      <footer className={styles.footer}>
        <span className={`${styles.state} ${!automatic ? styles.customState : ""}`}><i aria-hidden="true" />{changed ? "Unsaved order" : automatic ? "Automatic order" : "Custom order is active"}</span>
        <button type="button" className={`${styles.button} ${styles.restore}`} disabled={pending || automatic} onClick={() => { setCreators(quotationOrderCreators(items)); setAutomatic(true); setChanged(true); setMessage("Automatic order by tier and followers restored. Save order to apply."); }}>Restore automatic order</button>
        <button type="button" className={styles.button} disabled={pending} onClick={() => setOpen(false)}>Close</button>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={pending} onClick={save}>{savingOrder ? "Saving..." : "Save order"}</button>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <p role="status" className="sr-only">{message}</p>
      </footer>
    </DialogContent>
  </Dialog>;
}
