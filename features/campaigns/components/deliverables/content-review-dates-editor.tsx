"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getContentReviewDatesAction, saveContentReviewDatesAction } from "@/features/campaigns/actions/deliverable-documentation-actions";
import { emptyContentReviewDates, type ContentReviewDates } from "@/lib/services/deliverables/content-review-schedule";
import type { DocumentationUnitSummary } from "@/lib/services/deliverables/documentation-types";

export function ContentReviewDatesEditor({ unit }: { unit: DocumentationUnitSummary }) {
  const [dates, setDates] = useState<ContentReviewDates>(emptyContentReviewDates);
  const [saved, setSaved] = useState<ContentReviewDates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);
  const { campaignHeaderId, assignmentDeliverableId, assignmentPostScheduleId, sequenceNumber } = unit;
  useEffect(() => {
    let cancelled = false;
    void getContentReviewDatesAction({ campaignHeaderId, assignmentDeliverableId, assignmentPostScheduleId, sequenceNumber })
      .then(result => {
        if (cancelled) return;
        if (result.ok) { setDates(result.data); setSaved(result.data); }
        else setError(result.message);
      }).catch(() => { if (!cancelled) setError("Could not load review dates. Try again."); });
    return () => { cancelled = true; };
  }, [campaignHeaderId, assignmentDeliverableId, assignmentPostScheduleId, sequenceNumber, reload]);
  const dirty = saved && (dates.script !== saved.script || dates.draft !== saved.draft);
  return (
    <form className="rounded-lg border bg-background p-3 text-xs" onSubmit={event => {
      event.preventDefault();
      if (!saved || !dirty || pending) return;
      startTransition(async () => {
        try {
          const result = await saveContentReviewDatesAction({ campaignHeaderId, assignmentDeliverableId, assignmentPostScheduleId, sequenceNumber, dates, previous: saved });
          if (!result.ok) { setError(result.message); return; }
          setSaved(result.data); setError(null); toast.success("Expected review dates saved to the client workspace.");
        } catch { setError("Could not save review dates. Your edits are still here; try again."); }
      });
    }}>
      <p className="mb-1 font-semibold">Content review schedule</p>
      <p className="mb-2 text-muted-foreground">Dates the client can expect to receive content for review. Separate from publishing dates.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-36 flex-1 space-y-1">Expected script
          <Input aria-label="Expected script for review" type="date" className="h-8 text-xs" value={dates.script ?? ""} disabled={!saved || pending} onChange={event => setDates(current => ({ ...current, script: event.target.value || null }))} />
        </label>
        <label className="min-w-36 flex-1 space-y-1">Expected draft
          <Input aria-label="Expected draft for review" type="date" className="h-8 text-xs" value={dates.draft ?? ""} disabled={!saved || pending} onChange={event => setDates(current => ({ ...current, draft: event.target.value || null }))} />
        </label>
        <Button type="submit" size="sm" className="h-8 text-xs" disabled={!dirty || pending}>{pending ? "Saving…" : "Save dates"}</Button>
      </div>
      {error ? <p role="alert" className="mt-2 text-destructive">{error} <button type="button" className="underline" onClick={() => { setSaved(null); setError(null); setReload(value => value + 1); }}>Reload dates</button></p> : !saved ? <p role="status" className="mt-2 text-muted-foreground">Loading review dates…</p> : <p className="mt-2 text-muted-foreground">Blank dates appear as “To be confirmed.” Saving makes these dates visible to the client.</p>}
    </form>
  );
}
