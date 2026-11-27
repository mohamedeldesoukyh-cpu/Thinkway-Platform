"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getUnifiedCreatorCoreDetailAction } from "@/features/campaigns/creator-discovery-actions";
import { InlineCreatorMerge, MergeCreatorIdentity } from "@/features/discovery/delete-creator/inline-creator-merge";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export function PlatformOwnerConflict({ owner, currentUnifiedId, onMerged, onBusyChange, onIgnore }: {
  owner: UnifiedCreatorResult; currentUnifiedId: string; onMerged: (creator: UnifiedCreatorResult) => void; onBusyChange: (busy: boolean) => void; onIgnore: () => void;
}) {
  const [current, setCurrent] = useState<UnifiedCreatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="space-y-3 rounded-lg border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Account already linked</h3><Button type="button" variant="outline" disabled={busy} onClick={onIgnore}>Ignore and continue adding</Button></div>
    <p className="text-xs text-muted-foreground">Skip this account to add another link, or review a merge if both profiles are the same person.</p>
    {!current && <MergeCreatorIdentity creator={owner} label="Existing owner" />}
    <a className="inline-flex min-h-9 items-center text-sm text-primary underline" href={`/vendors/${encodeURIComponent(owner.influencer_id!)}`} target="_blank" rel="noopener noreferrer">Open existing creator ↗</a>
    {!current ? <Button variant="outline" disabled={loading} onClick={async () => {
      setLoading(true); setError("");
      try { const creator = await getUnifiedCreatorCoreDetailAction(currentUnifiedId); if (!creator?.influencer_id) throw new Error("The current creator needs a saved profile before merging."); setCurrent(creator); }
      catch (error) { setError(error instanceof Error ? error.message : "Could not load creator. Retry."); }
      finally { setLoading(false); }
    }}>{loading ? "Loading creator…" : "Preview merge"}</Button> : <InlineCreatorMerge source={owner} initialTarget={current} onMerged={onMerged} onBusyChange={value => { setBusy(value); onBusyChange(value); }} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
