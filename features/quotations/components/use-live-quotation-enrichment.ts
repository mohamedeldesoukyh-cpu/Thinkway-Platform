// Inherits the client boundary from quotation-workspace.tsx.
import { useEffect, useMemo, useState } from "react";
import type { QuotationItemRow } from "../types";
import { getQuotationEnrichmentUpdates } from "../enrichment-live-action";
import { isEnrichmentInProgress, resolveCreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";
import { watchShortlistEnrichment } from "@/features/discovery/shortlists/enrichment-live-poll";
type Updates = Awaited<ReturnType<typeof getQuotationEnrichmentUpdates>>;

export function useLiveQuotationEnrichment(quotationId: string, items: QuotationItemRow[]) {
  const [snapshot, setSnapshot] = useState<{ source: QuotationItemRow[]; updates: Updates }>();
  const [connectionDelayed, setConnectionDelayed] = useState(false);
  useEffect(() => {
    let ids = items.filter(item => item.influencer_id || item.profile_id || item.unified_id).map(item => item.id);
    if (!ids.length) return;
    const accumulated = new Map<string, Updates[number]>();
    let stop: (() => void) | undefined;
    stop = watchShortlistEnrichment({
      fetch: async () => {
        const updates: Updates = [];
        for (let i = 0; i < ids.length; i += 100) updates.push(...await getQuotationEnrichmentUpdates(quotationId, ids.slice(i, i + 100)));
        return updates;
      },
      onData: updates => {
        updates.forEach(update => accumulated.set(update.id, update));
        setSnapshot({ source: items, updates: [...accumulated.values()] });
        ids = updates.filter(update => isEnrichmentInProgress(resolveCreatorEnrichmentStatus(update.creator_profile_source.enrichmentDisplayStatus))).map(update => update.id);
        if (!ids.length) stop?.();
      },
      onError: setConnectionDelayed,
    });
    return stop;
  }, [quotationId, items]);
  const liveItems = useMemo(() => {
    if (snapshot?.source !== items) return items;
    const updates = new Map(snapshot.updates.map(update => [update.id, update]));
    return items.map(item => updates.has(item.id) ? { ...item, ...updates.get(item.id) } : item);
  }, [items, snapshot]);
  return { liveItems, connectionDelayed };
}
