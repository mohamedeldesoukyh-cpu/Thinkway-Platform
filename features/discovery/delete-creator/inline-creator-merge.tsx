
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreatorBrowse } from "@/features/creators/picker/creator-selection-hooks";
import { getMergeCreatorsEligibilityAction, mergeCreatorsAction } from "@/features/discovery/merge-creators/actions";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { MergeRateConflictResolver } from "@/features/discovery/merge-creators/rate-conflict-resolver";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

export function MergeCreatorIdentity({ creator, label }: { creator: UnifiedCreatorResult; label?: string }) {
  const accounts = [...new Set(creator.platforms.map(p => `${p.platform} · @${p.handle?.replace(/^@/, "") || "—"}`))];
  return <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-background p-3">
    <CreatorAvatarImage avatarUrl={creator.primaryAvatarUrl ?? creator.profile_image_url} profileUrl={creator.platforms[0]?.profile_url} alt={creator.display_name} size="md" />
    <div className="min-w-0 flex-1">
      {label && <p className="text-xs font-semibold text-primary">{label}</p>}
      <p className="break-words text-sm font-semibold" dir="auto">{creator.display_name}</p>
      {accounts.map(account => <p key={account} className="break-words text-xs text-muted-foreground" dir="auto">{account}</p>)}
    </div>
  </div>;
}

export function InlineCreatorMerge({ source, initialTarget, onMerged, onBusyChange }: {
  source: UnifiedCreatorResult; initialTarget?: UnifiedCreatorResult; onMerged: (creator: UnifiedCreatorResult) => void; onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(source.display_name.split(/\s+/)[0] ?? "");
  const [target, setTarget] = useState<UnifiedCreatorResult | null>(initialTarget ?? null);
  const [eligibility, setEligibility] = useState<{ canMerge: boolean; message: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [checkRevision, setCheckRevision] = useState(0);
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
  }, [target, source.influencer_id, checkRevision]);

  function merge() {
    if (!target?.influencer_id || !source.influencer_id || !confirmed || !eligibility?.canMerge || pending) return;
    onBusyChange(true);
    start(async () => {
      try {
        const result = await mergeCreatorsAction({ targetInfluencerId: target.influencer_id!, sourceInfluencerId: source.influencer_id!, targetUnifiedId: target.unified_id });
        if (!result.ok) { setEligibility({ canMerge: false, message: result.message }); toast.error(result.message); return; }
        toast.success(result.message); router.refresh(); onMerged(result.creator);
      } catch { toast.error("Could not complete the merge. Please retry."); }
      finally { onBusyChange(false); }
    });
  }
  const candidates = browse.creators.filter(item => item.influencer_id && item.influencer_id !== source.influencer_id);
  return <section className="space-y-3">
    <h3 className="text-sm font-semibold">Preview merge</h3>
    <p className="text-xs text-muted-foreground">Accounts and linked records move to the profile you keep. Review both creators before confirming.</p>
    {!target ? <>
      <label className="block text-sm font-medium" htmlFor="merge-creator-search">Choose the creator to keep</label>
      <Input id="merge-creator-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or account handle" />
      <p className="text-xs text-muted-foreground">Suggested matches by name — select only if they are the same person.</p>
      {browse.loading ? <p role="status">Finding creators…</p> : browse.error ? <p role="alert">{browse.error} <Button variant="outline" onClick={browse.retry}>Retry</Button></p> : <div className="max-h-48 space-y-2 overflow-auto">
        {candidates.map(item => <button type="button" key={item.unified_id} className="flex min-h-11 w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted focus-visible:ring-2" onClick={() => setTarget(item)}>
          <MergeCreatorIdentity creator={item} /><span className="shrink-0 text-xs text-primary">Keep</span>
        </button>)}
        {!candidates.length && <p className="text-sm">No other saved creators match. Try another name or handle here.</p>}
      </div>}
      {browse.totalPages > 1 && <div className="flex items-center gap-3"><Button variant="outline" disabled={browse.page <= 1 || browse.loading} onClick={() => browse.goToPage(browse.page - 1)}>Previous</Button><span>{browse.page} / {browse.totalPages}</span><Button variant="outline" disabled={browse.page >= browse.totalPages || browse.loading} onClick={() => browse.goToPage(browse.page + 1)}>Next</Button></div>}
    </> : <>
      <div className="grid gap-3 sm:grid-cols-2"><MergeCreatorIdentity creator={target} label="Keep this creator" /><MergeCreatorIdentity creator={source} label="Transfer, then remove duplicate" /></div>
      <Button variant="outline" disabled={pending} onClick={() => setTarget(null)}>Choose a different creator</Button>
      <p role="status" className="text-sm">{eligibility?.message ?? "Checking linked records and overlapping prices…"}</p>
      {eligibility?.message.includes("Both creators have prices in the same rate card") && target.influencer_id && source.influencer_id && <MergeRateConflictResolver key={`${target.influencer_id}:${source.influencer_id}`} targetId={target.influencer_id} sourceId={source.influencer_id} targetName={target.display_name} sourceName={source.display_name} onResolved={() => setCheckRevision(value => value + 1)} />}
      {eligibility?.canMerge && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)} />These profiles are the same person. Keep {target.display_name} and remove the duplicate. This cannot be undone.</label>}
      <Button disabled={!eligibility?.canMerge || !confirmed || pending} onClick={merge}>{pending ? "Merging…" : "Confirm merge and transfer records"}</Button>
    </>}
  </section>;
}
