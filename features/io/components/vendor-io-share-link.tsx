"use client";

import { useState } from "react";
import { LinkIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getVendorIoShareLink } from "../vendor-io-share-link-action";

export function VendorIoShareLink({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  async function show() {
    setOpen(true); setLoading(true); setUrl(""); setMessage("");
    try { const result = await getVendorIoShareLink(id); setUrl(result.url ?? ""); setMessage(result.message ?? ""); }
    catch { setMessage("Could not load the link. Please try again."); }
    finally { setLoading(false); }
  }
  return <>
    <Button type="button" variant="outline" size="sm" onClick={show}><LinkIcon className="mr-1 size-4" />Show signing link</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg overflow-hidden">
        <DialogHeader><DialogTitle>Creator signing link</DialogTitle><DialogDescription>Copy the active emailed link and send it privately to this creator on WhatsApp. Resending the IO replaces the previous link.</DialogDescription></DialogHeader>
        {loading && <p role="status">Loading link…</p>}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        {url && <div className="min-w-0 space-y-3">
          <label className="block text-sm font-medium" htmlFor={`signing-link-${id}`}>Signing link</label>
          <textarea id={`signing-link-${id}`} readOnly value={url} rows={3} onFocus={e => e.currentTarget.select()}
            className="w-full resize-none break-all rounded-lg border bg-muted/30 p-3 text-base" />
          <Button type="button" className="min-h-12 w-full" onClick={async () => {
            try { await navigator.clipboard.writeText(url); toast.success("Signing link copied"); }
            catch { toast.error("Tap and hold the link above, then choose Copy."); }
          }}><CopyIcon className="mr-2 size-4" />Copy link</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
