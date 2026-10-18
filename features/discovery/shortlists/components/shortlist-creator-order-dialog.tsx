"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, ListOrderedIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { resolveCreatorTierFromUnified } from "@/lib/creators/creator-tier";
import { moveCreator } from "@/lib/quotations/quotation-creator-order";
import { QuotationTemplatePhotoEditor } from "@/features/quotations/components/quotation-template-photo-editor";
import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { setShortlistTemplatePhoto, setShortlistCreatorOrder } from "../actions";
import { tierOrderShortlistCreators } from "../shortlist-creator-order";
import type { ShortlistCreatorItem } from "../types";
import styles from "@/features/discovery/document-preview/creator-dialog.module.css";

export function ShortlistCreatorOrderDialog({ shortlistId, items }: { shortlistId: string; items: ShortlistCreatorItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(items);
  const [dragged, setDragged] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [savingOrder, startTransition] = useTransition();
  const [photoBusy, setPhotoBusy] = useState(false);
  const pending = savingOrder || photoBusy;
  const [announcement, setAnnouncement] = useState("");
  function move(from: number, to: number) {
    if (pending || to < 0 || to >= rows.length) return;
    setRows(current => moveCreator(current, from, to));
    setAnnouncement("Creator moved to position " + (to + 1));
  }
  return <Dialog open={open} onOpenChange={value => { if (pending) return; if (value) { setRows(items); setError(""); } setOpen(value); }}>
    <DialogTrigger asChild><button type="button" className="tw-b sm"><ListOrderedIcon className="size-4" />Order creators</button></DialogTrigger>
    <DialogContent className={styles.dialog}>
      <div className={styles.header}>
        <DialogTitle className={styles.title}>Order creators</DialogTitle>
        <DialogDescription className={styles.subtitle}>Drag creators or use the arrows. Save to apply this order to the shortlist, client workspace and reports. Stars stay attached when you reorder. Upload and apply photos for this shortlist’s reports and client workspace.</DialogDescription>
        <button type="button" className={styles.button} disabled={pending} onClick={() => { setRows(tierOrderShortlistCreators(rows)); setAnnouncement("Sorted by tier, highest first, then followers."); }}>Sort by tier · highest first</button>
      </div>
      <div className="sr-only" role="status">{announcement}</div>
      <div className={styles.body}><ol className={styles.rows}>{rows.map((item, index) => {
        const name = item.creator?.display_name || "Unnamed creator";
        const profile = item.creator ? creatorProfileSourceFromUnified(item.creator) : null;
        const tier = item.creator ? resolveCreatorTierFromUnified(item.creator) : "Unknown";
        return <li key={item.item_id} className={styles.row} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged !== null) move(dragged, index); setDragged(null); }}>
          <span className={styles.position}>{index + 1}</span>
          <button type="button" className={styles.grip} draggable={!pending} disabled={pending} aria-label={"Reorder " + name + ". Use Alt and arrow keys."} onDragStart={() => setDragged(index)} onDragEnd={() => setDragged(null)} onKeyDown={event => { if (event.altKey && ["ArrowUp","ArrowDown"].includes(event.key)) { event.preventDefault(); move(index, index + (event.key === "ArrowUp" ? -1 : 1)); } }}><GripVerticalIcon className="size-4" /></button>
          <QuotationTemplatePhotoEditor quotationId={shortlistId} itemId={item.item_id} name={name} optionCount={1}
            documentLabel="shortlist" detailLabel={`${tier}${item.recommendationRank ? ` · ★ Recommended ${item.recommendationRank}` : ""}`}
            original={creatorAvatarBrowserDisplayUrl(profile?.avatarUrl, null)} current={item.templatePhoto}
            savePhoto={setShortlistTemplatePhoto} disabled={pending} onBusy={setPhotoBusy}
            onApplied={photo => { setRows(current => current.map(row => row.item_id === item.item_id ? {...row,templatePhoto:photo ?? undefined} : row)); router.refresh(); }}
            controls={<div className={styles.orderActions}><button type="button" className={styles.button} disabled={pending || index === 0} aria-label={"Move " + name + " up"} onClick={() => move(index,index-1)}><ArrowUpIcon className="size-4" /></button><button type="button" className={styles.button} disabled={pending || index === rows.length-1} aria-label={"Move " + name + " down"} onClick={() => move(index,index+1)}><ArrowDownIcon className="size-4" /></button></div>} />
        </li>;
      })}</ol></div>
      {error && <p role="alert" className="px-5 text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t p-3"><button type="button" className={styles.button} disabled={pending} onClick={() => startTransition(async () => { try { const result = await setShortlistCreatorOrder(shortlistId, []); if (!result.ok) { setError(result.message); return; } setOpen(false); router.refresh(); } catch { setError("Unable to reset order. Try again."); } })}>Restore recommendation order</button><button type="button" className={styles.button} disabled={pending} onClick={() => setOpen(false)}>Cancel</button><button type="button" className="tw-b pri" disabled={pending} onClick={() => startTransition(async () => { try { const result = await setShortlistCreatorOrder(shortlistId, rows.map(item => item.item_id)); if (!result.ok) { setError(result.message); return; } setOpen(false); router.refresh(); } catch { setError("Unable to save order. Please try again."); } })}>{pending ? "Saving…" : "Save order"}</button></div>
    </DialogContent>
  </Dialog>;
}
