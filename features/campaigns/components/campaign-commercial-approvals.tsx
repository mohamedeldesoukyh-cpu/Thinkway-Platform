"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listCommercialRevisionsAction } from "@/features/campaigns/actions/commercial-revision-actions";
import { CommercialVersionHistoryDialog } from "./commercial-version-history-dialog";
import type { CommercialRevisionRecord } from "@/lib/services/commercial/commercial-revision-types";

export const COMMERCIAL_REVISIONS_CHANGED = "commercial-revisions-changed";

/** Visible entry point to the existing commercial approval workflow. */
export function CampaignCommercialApprovals({ campaignHeaderId, refreshKey }: {
  campaignHeaderId: string;
  refreshKey?: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<CommercialRevisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let request = 0;
    async function load() {
      const current = ++request;
      try {
        const result = await listCommercialRevisionsAction({ campaignHeaderId });
        if (cancelled || current !== request) return;
        if (result.ok) {
          setRevisions(result.data.revisions);
          setError(null);
        } else setError(result.message);
      } catch {
        if (!cancelled && current === request) setError("Could not load commercial approvals. Please retry.");
      } finally {
        if (!cancelled && current === request) setLoading(false);
      }
    }
    void load();
    window.addEventListener(COMMERCIAL_REVISIONS_CHANGED, load);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener(COMMERCIAL_REVISIONS_CHANGED, load);
      window.removeEventListener("focus", load);
    };
  }, [campaignHeaderId, refreshKey, retry]);

  const pending = revisions.filter(revision => revision.status === "pending_approval");
  return <>
    <section aria-label="Commercial approvals" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${pending.length ? "border-amber-200 bg-amber-50 text-amber-950" : "border-border bg-card"}`}>
      <div aria-live="polite">
        <h3 className="font-semibold">Commercial approvals{pending.length > 0 ? ` · ${pending.length} awaiting decision` : ""}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{loading ? "Checking commercial revisions…" : error ? error : pending.length
          ? `${pending.map(revision => `R${revision.revisionNumber}`).join(", ")} — proposed commercial changes need approval. Review the changes, then approve or reject.`
          : "No commercial revisions awaiting approval."}</p>
      </div>
      <div className="flex gap-2">
        {error && <Button size="sm" variant="outline" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</Button>}
        <Button size="sm" variant={pending.length ? "default" : "outline"} onClick={() => setOpen(true)}>{pending.length ? "Review & decide" : "Commercial history"}</Button>
      </div>
    </section>
    <CommercialVersionHistoryDialog open={open} onOpenChange={setOpen} campaignHeaderId={campaignHeaderId}/>
  </>;
}
