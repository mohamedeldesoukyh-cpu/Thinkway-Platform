import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Inherits the workspace's client boundary; signed URLs are never sent to external viewers. */
export function WorkspaceDocumentPreview({ open, onOpenChange, url, title }: {
  open: boolean; onOpenChange: (open: boolean) => void; url: string; title: string;
}) {
  const [document, setDocument] = useState<{ url?: string; html?: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setDocument(null); setError("");
    void fetch(url, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Could not load the preview. Please try again.");
      const isHtml = response.headers.get("content-type")?.includes("text/html");
      if (isHtml) {
        const html = await response.text();
        if (!controller.signal.aborted) setDocument({ html });
      } else {
        const blob = await response.blob();
        if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setDocument({ url: objectUrl }); }
      }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, url, retry]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false} aria-describedby={undefined} className="flex flex-col gap-0 overflow-hidden p-0" style={{ width: "96vw", maxWidth: 1440, height: "94dvh" }}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div><DialogTitle>{title}</DialogTitle><p className="text-xs text-muted-foreground">Actual size · 100%</p></div>
        <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700" aria-label="Close preview"><X /></Button></DialogClose>
      </header>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-100">
        {error ? <div className="p-6" role="alert">{error}<Button variant="outline" className="ml-3" onClick={() => setRetry(n => n + 1)}>Retry</Button></div>
          : document ? <iframe title={title} referrerPolicy="no-referrer" {...(document.html ? { srcDoc: document.html, sandbox: "" } : { src: `${document.url}#zoom=100` })} className="h-full w-full border-0" />
            : <p className="p-6" role="status">Preparing preview…</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
