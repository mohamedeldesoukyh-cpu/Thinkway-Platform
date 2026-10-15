"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, ListOrderedIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { QuotationItemRow } from "@/features/quotations/types";
import { moveCreator, quotationOrderCreators } from "@/lib/quotations/quotation-creator-order";
import { QuotationTemplatePhotoEditor } from "./quotation-template-photo-editor";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { setQuotationCreatorOrder } from "@/features/quotations/actions";

export function QuotationCreatorOrderDialog({ quotationId, items, savedOrder, savedPhotos, onSaved }: {
  quotationId: string; items: QuotationItemRow[]; savedOrder?: string[]; savedPhotos?: Record<string, string>; onSaved: (order: string[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creators, setCreators] = useState(() => quotationOrderCreators(items, savedOrder));
  const [automatic, setAutomatic] = useState(false);
  const [savingOrder, startTransition] = useTransition();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photos, setPhotos] = useState(savedPhotos ?? {});
  useEffect(() => setPhotos(savedPhotos ?? {}), [savedPhotos]);
  const pending = savingOrder || photoBusy;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function reposition(from: number, to: number) {
    setCreators(current => moveCreator(current, from, to));
    setAutomatic(false);
    setMessage(`${creators[from].name} moved to position ${Math.max(1, Math.min(to + 1, creators.length))}.`);
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
    if (next) { setCreators(quotationOrderCreators(items, savedOrder)); setAutomatic(false); setMessage(""); setError(""); }
    setOpen(next);
  }}>
    <DialogTrigger asChild><button type="button" className="tw-b sm"><ListOrderedIcon size={16} /> Order creators</button></DialogTrigger>
    <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto" showCloseButton={!pending}>
      <div className="pr-8"><DialogTitle>Order creators</DialogTitle><DialogDescription className="mt-2">Set the order for this quotation, Creator List, Client List by Name, and the linked client workspace. Each creator’s options stay together.</DialogDescription><p className="mt-2 text-sm text-muted-foreground">Upload a JPG, PNG or WebP photo up to 750 KB, then Apply photo. Applied photos are saved immediately for this quotation’s templates only. Creator profiles and client workspace photos stay unchanged.</p></div>
      <Button type="button" variant="outline" disabled={pending} onClick={() => { setCreators(quotationOrderCreators(items)); setAutomatic(true); setMessage("Automatic order by tier and followers restored. Save to apply."); }}>Restore automatic order</Button>
      <ol className="grid gap-2" aria-label="Creator order">
        {creators.map((creator, index) => <li key={creator.key} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <span className="w-6 text-muted-foreground" aria-hidden="true">{index + 1}</span>
          <span className="min-w-0 flex-1 basis-36"><strong className="block break-words" dir="auto">{creator.name}</strong><span className="block break-words text-xs text-muted-foreground">{creator.handle} · {creator.items.length} {creator.items.length === 1 ? "option" : "options"}</span></span>
          <div className="flex items-center gap-1">
            <label className="sr-only" htmlFor={`creator-position-${creator.items[0].id}`}>Position for {creator.name}</label>
            <select id={`creator-position-${creator.items[0].id}`} className="h-10 rounded-lg border bg-background px-2" value={index} disabled={pending} onChange={event => reposition(index, Number(event.target.value))}>
              {creators.map((_, position) => <option key={position} value={position}>{position + 1}</option>)}
            </select>
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 aria-disabled:opacity-40" aria-label={`Move ${creator.name} up`} aria-disabled={pending || index === 0} onClick={() => { if (!pending && index > 0) reposition(index, index - 1); }}><ArrowUpIcon /></Button>
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 aria-disabled:opacity-40" aria-label={`Move ${creator.name} down`} aria-disabled={pending || index === creators.length - 1} onClick={() => { if (!pending && index < creators.length - 1) reposition(index, index + 1); }}><ArrowDownIcon /></Button>
          </div>
          <QuotationTemplatePhotoEditor quotationId={quotationId} itemId={creator.items[0].id} name={creator.name}
            original={creatorAvatarBrowserDisplayUrl(creator.items[0].creator_profile_source?.avatarUrl || creator.items[0].profile_image_url, creator.items[0].profile_url)}
            current={photos[creator.key]} disabled={pending} onBusy={setPhotoBusy} onApplied={photo => {
              setPhotos(current => { const next = {...current}; if (photo) next[creator.key] = photo; else delete next[creator.key]; return next; });
              router.refresh();
            }} />
        </li>)}
      </ol>
      <p role="status" className="text-sm text-muted-foreground">{message || (savedOrder?.length ? "Custom order is active." : "Currently ordered automatically by tier and followers.")}</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Close</Button><Button type="button" disabled={pending} onClick={save}>{savingOrder ? "Saving..." : "Save order"}</Button></div>
    </DialogContent>
  </Dialog>;
}
