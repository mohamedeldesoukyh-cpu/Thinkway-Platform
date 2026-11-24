"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceDocumentPreview } from "./workspace-document-preview";
import { Button } from "@/components/ui/button";
import { loadClientPerformanceAllowanceAction, refreshClientPerformanceAction } from "../actions/client-performance-actions";

export function ClientPerformanceControls({ token, historical }: { token: string; historical: boolean }) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [allowance, setAllowance] = useState<{ limit: number; used: number; refreshing: boolean; lastRefreshAt: string | null; coolingDown: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retryable, setRetryable] = useState(false);
  const requestId = useRef<string | null>(null);
  const wasRefreshing = useRef(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await loadClientPerformanceAllowanceAction(token);
        if (cancelled) return;
        if (!result.ok) { setMessage(result.message); return; }
        setAllowance(result);
        if (wasRefreshing.current && !result.refreshing) router.refresh();
        wasRefreshing.current = result.refreshing;
      } catch { if (!cancelled) setMessage("Could not load refresh allowance."); }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [token, router]);

  async function refresh() {
    if (busy) return;
    setBusy(true); setMessage("");
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await refreshClientPerformanceAction(token, requestId.current);
      setMessage(result.message);
      setRetryable(!result.ok && result.retryable);
      if (result.ok || !result.retryable) requestId.current = null;
      const updated = await loadClientPerformanceAllowanceAction(token);
      if (updated.ok) setAllowance(updated);
      if (result.ok) { wasRefreshing.current = true; router.refresh(); }
    } catch { setRetryable(true); setMessage("Connection interrupted. Retry the same request to check your refresh."); }
    finally { setBusy(false); }
  }
  const coolingDown = allowance?.coolingDown ?? false;
  return <><section className="card" aria-label="Performance report controls">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h3 className="text-sm font-semibold">Refresh data</h3>
        <p className="mt-1 text-sm" aria-live="polite">{allowance ? `${allowance.used} of ${allowance.limit} refreshes used · ${Math.max(0, allowance.limit - allowance.used)} remaining` : "Loading refresh allowance…"}</p>
        <p className="mt-1 text-xs text-muted-foreground">One refresh updates published campaign metrics. Downloads use the latest saved data and do not use credits.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!historical && <Button type="button" size="sm" disabled={busy || !allowance || (!retryable && (allowance.used >= allowance.limit || allowance.refreshing || coolingDown))} onClick={() => void refresh()}>{busy ? "Requesting refresh…" : retryable ? "Retry refresh request" : allowance?.refreshing ? "Refreshing data…" : "Refresh data"}</Button>}
        <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>Preview report</Button>
        <Button size="sm" variant="outline" asChild><a href={`/api/review/performance?${new URLSearchParams({ sign: token, format: "pdf" })}`} target="_blank" rel="noreferrer">Download PDF</a></Button>
      </div>
      {coolingDown && !allowance?.refreshing && <p className="w-full text-xs text-muted-foreground">Allow five minutes between refresh requests.</p>}
      {message && <p className="w-full text-sm" role="status">{message}</p>}
    </div>
  </section><WorkspaceDocumentPreview open={previewOpen} onOpenChange={setPreviewOpen} title="Performance report" url={`/api/review/performance?${new URLSearchParams({ sign: token, view: "1" })}`} /></>;
}
