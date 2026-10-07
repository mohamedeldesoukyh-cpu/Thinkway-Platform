"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { processCreatorDeletionBatch } from "./actions";
import { DeleteDiscoveryCreatorDialog } from "./delete-discovery-creator-dialog";

type Result = Awaited<ReturnType<typeof processCreatorDeletionBatch>>[number];
export function BulkDeleteCreatorsDialog({ creators, onClose, onDeleted }: {
  creators: UnifiedCreatorResult[]; onClose: () => void; onDeleted: (creator: UnifiedCreatorResult) => void;
}) {
  const [selection] = useState(creators);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState<UnifiedCreatorResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(selection.flatMap(item => item.influencer_id ? [item.influencer_id] : []))];
    setBusy(true); setError(""); setResults([]); setConfirmed(false);
    void (async () => {
      try { for (let i = 0; i < ids.length; i += 10) {
        const batch = await processCreatorDeletionBatch(ids.slice(i, i + 10));
        if (cancelled) return;
        setResults(previous => [...previous, ...batch]);
      } } catch { if (!cancelled) setError("Could not finish checking the selection. Retry before deleting."); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [selection]);
  const eligible = results.filter(result => result.canDelete && !result.deleted);
  async function remove() {
    if (busy || !confirmed || error || !eligible.length) return;
    setBusy(true); setConfirmed(false);
    try { for (let i = 0; i < eligible.length; i += 10) {
      const batch = await processCreatorDeletionBatch(eligible.slice(i, i + 10).map(result => result.id), true);
      setResults(previous => previous.map(row => batch.find(next => next.id === row.id) ?? row));
      for (const row of batch.filter(row => row.deleted)) {
        const creator = selection.find(item => item.influencer_id === row.id); if (creator) onDeleted(creator);
      }
    } } catch { setError("Processing stopped. Completed deletions are shown below. Close and reopen to recheck remaining creators."); }
    finally { setBusy(false); }
  }
  return <><Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Delete selected creators</DialogTitle><DialogDescription>Only creators without protected records can be deleted. Archived shortlist entries are removed with the creator. Deletion cannot be undone.</DialogDescription></DialogHeader>
    <p role="status" className="text-sm">{busy ? "Processing selection… " : ""}{eligible.length} eligible · {results.filter(row => !row.canDelete && !row.deleted).length} blocked · {results.filter(row => row.deleted).length} deleted</p>
    <div className="max-h-72 space-y-2 overflow-auto">{selection.map(creator => {
      const result = results.find(row => row.id === creator.influencer_id);
      return <div key={creator.unified_id} className="rounded-lg border p-3 text-sm"><strong>{creator.display_name}</strong><p>{!creator.influencer_id ? "Discovery-only result: no saved creator to delete." : result?.deleted ? "Deleted" : result?.canDelete ? "Ready to delete" : result?.message ?? "Waiting for checks…"}</p>
        {result?.links.map(link => <p key={`${link.kind}:${link.id}`}>{link.reference}{link.href && <a className="ml-2 text-primary underline" target="_blank" rel="noopener noreferrer" href={link.href}>Open record ↗</a>}</p>)}
        {result && !result.canDelete && !result.deleted && <Button variant="outline" disabled={busy} onClick={() => setReview(creator)}>Review / merge</Button>}
      </div>;
    })}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!busy && !error && eligible.length > 0 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Permanently delete these {eligible.length} eligible creators. Keep all blocked creators.</label>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button variant="destructive" disabled={busy || !confirmed || !!error || !eligible.length} onClick={remove}>Delete {eligible.length} eligible creators</Button></DialogFooter>
  </DialogContent></Dialog>{review && <DeleteDiscoveryCreatorDialog open creator={review} onOpenChange={open => { if (!open) setReview(null); }} onDeleted={() => { onDeleted(review); setReview(null); onClose(); }} />}</>;
}
