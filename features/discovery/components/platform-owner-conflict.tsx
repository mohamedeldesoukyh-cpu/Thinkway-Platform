"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getUnifiedCreatorCoreDetailAction } from "@/features/campaigns/creator-discovery-actions";
import { InlineCreatorMerge } from "@/features/discovery/delete-creator/inline-creator-merge";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export function PlatformOwnerConflict({ owner, currentUnifiedId, onMerged, onBusyChange }: {
  owner: UnifiedCreatorResult; currentUnifiedId: string; onMerged: (creator: UnifiedCreatorResult) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [current, setCurrent] = useState<UnifiedCreatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return <section className="space-y-3 rounded-lg border p-3">
    <h3 className="font-semibold">This account belongs to {owner.display_name}</h3>
    <a className="inline-flex min-h-9 items-center text-sm text-primary underline" href={`/vendors/${encodeURIComponent(owner.influencer_id!)}`} target="_blank" rel="noopener noreferrer">Open existing creator ↗</a>
    <ul className="space-y-1 text-sm">{owner.platforms.map((platform, index) => <li key={platform.id ?? index}>{platform.platform} · @{platform.handle} {platform.profile_url && /^https?:\/\//i.test(platform.profile_url) && <a className="text-primary underline" href={platform.profile_url} target="_blank" rel="noopener noreferrer">View account ↗</a>}</li>)}</ul>
    {!current ? <Button variant="outline" disabled={loading} onClick={async () => {
      setLoading(true); setError("");
      try { const creator = await getUnifiedCreatorCoreDetailAction(currentUnifiedId); if (!creator?.influencer_id) throw new Error("The current creator needs a saved profile before merging."); setCurrent(creator); }
      catch (error) { setError(error instanceof Error ? error.message : "Could not load creator. Retry."); }
      finally { setLoading(false); }
    }}>{loading ? "Loading creator…" : "Review merge into this creator"}</Button> : <InlineCreatorMerge source={owner} initialTarget={current} onMerged={onMerged} onBusyChange={onBusyChange} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
