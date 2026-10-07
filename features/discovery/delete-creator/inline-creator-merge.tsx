"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreatorBrowse } from "@/features/creators/picker/creator-selection-hooks";
import { getMergeCreatorsEligibilityAction, mergeCreatorsAction } from "@/features/discovery/merge-creators/actions";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export function InlineCreatorMerge({ source, onMerged, onBusyChange }: {
  source: UnifiedCreatorResult; onMerged: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(source.display_name.split(/\s+/)[0] ?? "");
  const [target, setTarget] = useState<UnifiedCreatorResult | null>(null);
  const [eligibility, setEligibility] = useState<{ canMerge: boolean; message: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();
  const browse = useCreatorBrowse({ enabled: !target, filters: { search }, pageSize: 20 });
  useEffect(() => {
    let active = true;
    setEligibility(null); setConfirmed(false);
    if (target?.influencer_id && source.influencer_id) {
      void getMergeCreatorsEligibilityAction({ targetInfluencerId: target.influencer_id, sourceInfluencerId: source.influencer_id })
        .then(result => { if (active) setEligibility(result); })
        .catch(() => { if (active) setEligibility({ canMerge: false, message: "Could not check this merge. Choose the creator again to retry." }); });
    }
    return () => { active = false; };
  }, [target, source.influencer_id]);

  function merge() {
    if (!target?.influencer_id || !source.influencer_id || !confirmed || !eligibility?.canMerge || pending) return;
    onBusyChange(true);
    start(async () => {
      try {
        const result = await mergeCreatorsAction({ targetInfluencerId: target.influencer_id!, sourceInfluencerId: source.influencer_id!, targetUnifiedId: target.unified_id });
        if (!result.ok) { setEligibility({ canMerge: false, message: result.message }); toast.error(result.message); return; }
        toast.success(result.message); router.refresh(); onMerged();
      } catch { toast.error("Could not complete the merge. Please retry."); }
      finally { onBusyChange(false); }
    });
  }
  const candidates = browse.creators.filter(item => item.influencer_id && item.influencer_id !== source.influencer_id);
  return <section className="space-y-3 rounded-xl border p-4">
    <h3 className="font-semibold">Merge duplicate and keep linked records</h3>
    <p className="text-sm text-muted-foreground">Choose the profile to keep. Accounts and linked records from {source.display_name} will transfer to it, then this duplicate will be removed.</p>
    {!target ? <>
      <label className="block text-sm font-medium" htmlFor="merge-creator-search">Choose the creator to keep</label>
      <Input id="merge-creator-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or account handle" />
      <p className="text-xs text-muted-foreground">Suggested matches by name — select only if they are the same person.</p>
      {browse.loading ? <p role="status">Finding creators…</p> : browse.error ? <p role="alert">{browse.error} <Button variant="outline" onClick={browse.retry}>Retry</Button></p> : <div className="max-h-48 space-y-2 overflow-auto">
        {candidates.map(item => <button type="button" key={item.unified_id} className="flex min-h-11 w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted focus-visible:ring-2" onClick={() => setTarget(item)}>
          <span><strong className="block text-sm">{item.display_name}</strong><span className="text-xs text-muted-foreground">{item.platforms.map(p => p.platform).join(" · ")} · {item.platforms.map(p => p.handle).filter(Boolean).join(" · ")}</span></span><span className="text-sm text-primary">Keep this creator</span>
        </button>)}
        {!candidates.length && <p className="text-sm">No other saved creators match. Try another name or handle here.</p>}
      </div>}
      {browse.totalPages > 1 && <div className="flex items-center gap-3"><Button variant="outline" disabled={browse.page <= 1 || browse.loading} onClick={() => browse.goToPage(browse.page - 1)}>Previous</Button><span>{browse.page} / {browse.totalPages}</span><Button variant="outline" disabled={browse.page >= browse.totalPages || browse.loading} onClick={() => browse.goToPage(browse.page + 1)}>Next</Button></div>}
    </> : <>
      <div className="rounded-lg bg-muted p-3 text-sm"><p><strong>Keep:</strong> {target.display_name} · {target.platforms.map(p => p.handle).filter(Boolean).join(" · ")}</p><p><strong>Remove after transfer:</strong> {source.display_name} · {source.platforms.map(p => p.handle).filter(Boolean).join(" · ")}</p></div>
      <Button variant="outline" disabled={pending} onClick={() => setTarget(null)}>Choose a different creator</Button>
      <p role="status" className="text-sm">{eligibility?.message ?? "Checking linked records and overlapping prices…"}</p>
      {eligibility?.canMerge && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)} />These profiles are the same person. Keep {target.display_name} and remove the duplicate. This cannot be undone.</label>}
      <Button disabled={!eligibility?.canMerge || !confirmed || pending} onClick={merge}>{pending ? "Merging…" : "Confirm merge and transfer records"}</Button>
    </>}
  </section>;
}
