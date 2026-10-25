"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** The same authenticated HTML used by downloads, without navigating away. */
export function ReviewSchedulePreview({ campaignId, token, onDownload, downloading = false }: {
  campaignId: string;
  token?: string;
  onDownload: (format: "pdf" | "xlsx" | "html") => void;
  downloading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setHtml(""); setError("");
    void fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/review-schedule.html`, {
      cache: "no-store", signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).then(async response => {
      if (!response.ok) throw new Error("Could not load the schedule preview. Please try again.");
      const content = await response.text();
      if (!controller.signal.aborted) setHtml(content);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Preview unavailable.");
    });
    return () => controller.abort();
  }, [open, campaignId, token, retry]);

  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Preview schedule</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined} className="flex flex-col gap-0 overflow-hidden p-0" style={{ width: "94vw", maxWidth: "1440px", height: "92dvh" }}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3 pr-16">
          <DialogTitle className="text-base">Schedule preview</DialogTitle>
          <div className="flex gap-2" aria-label="Schedule downloads">
            {([['pdf','PDF'],['xlsx','Excel'],['html','HTML']] as const).map(([format,label]) =>
              <Button type="button" variant="outline" size="sm" key={format} disabled={downloading || !html} onClick={() => onDownload(format)}>{label}</Button>)}
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-slate-100">
          {error ? <div role="alert" className="p-6 text-center"><p>{error}</p><Button className="mt-3" variant="outline" onClick={() => setRetry(value => value + 1)}>Retry preview</Button></div>
            : html ? <iframe title="Content review schedule report" sandbox="" referrerPolicy="no-referrer" srcDoc={html} className="h-full w-full border-0" />
              : <p role="status" className="p-6 text-center">Preparing schedule preview…</p>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
