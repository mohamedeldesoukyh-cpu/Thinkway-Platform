"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MergeRateConflict, MergeRateRow } from "@/lib/discovery/merge-rate-conflicts";
import { getMergeRateConflictsAction, resolveMergeRateConflictsAction } from "./rate-conflict-actions";

function Price({ row }: { row: MergeRateRow }) {
  return <span className="block space-y-1 text-xs">
    <strong className="block text-sm">{Number(row.amount).toLocaleString()} {row.currency}</strong>
    {row.agency_fee_percent != null && <span className="block">Agency fee: {String(row.agency_fee_percent)}%</span>}
    {Number(row.period_months) > 0 && <span className="block">Period: {String(row.period_months)} months</span>}
    {row.package_details != null && <span className="block break-words">Package: {JSON.stringify(row.package_details)}</span>}
    {row.notes && <span className="block whitespace-pre-wrap">{row.notes}</span>}
  </span>;
}

export function MergeRateConflictResolver({ targetId, sourceId, targetName, sourceName, onResolved }: {
  targetId: string; sourceId: string; targetName: string; sourceName: string; onResolved: () => void;
}) {
  const [conflicts, setConflicts] = useState<MergeRateConflict[]>([]);
  const [choices, setChoices] = useState<Record<string, "target" | "source">>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setChoices({}); setConfirmed(false);
    void getMergeRateConflictsAction({ targetInfluencerId: targetId, sourceInfluencerId: sourceId })
      .then(rows => { if (active) setConflicts(rows); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Could not load prices."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [targetId, sourceId, revision]);

  async function resolve() {
    setBusy(true); setError(null);
    try {
      await resolveMergeRateConflictsAction({ targetInfluencerId: targetId, sourceInfluencerId: sourceId,
        choices: conflicts.map(row => choices[row.target.id] === "target" ? { keep: row.target, remove: row.source } : { keep: row.source, remove: row.target }),
      });
      onResolved();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save choices."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border bg-background p-3 text-foreground">
    <h3 className="text-sm font-semibold">Choose which prices to keep</h3>
    <p className="text-xs text-muted-foreground">Compare each overlapping line below. Saving removes only the prices you do not choose. Other prices remain, and you can then continue the merge.</p>
    {loading ? <p role="status">Loading price comparison…</p> : <>
      {conflicts.length > 0 && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { setChoices(Object.fromEntries(conflicts.map(row => [row.target.id, "target"]))); setConfirmed(false); }}>Choose all from {targetName}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { setChoices(Object.fromEntries(conflicts.map(row => [row.target.id, "source"]))); setConfirmed(false); }}>Choose all from {sourceName}</Button>
      </div>}
      <div className="max-h-[38vh] space-y-3 overflow-y-auto">
        {conflicts.map(row => <fieldset key={row.target.id} className="min-w-0 rounded-lg border p-3" disabled={busy}>
          <legend className="px-1 text-xs font-semibold">{row.title} · {row.target.platform} · {row.target.deliverable} · {row.target.price_type === "creator_cost" ? "Creator cost" : "Client price"}</legend>
          <a className="text-xs text-primary underline" href={`/rate-cards?version=${encodeURIComponent(row.target.version_id)}`} target="_blank" rel="noreferrer">Open rate card</a>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{(["target", "source"] as const).map(side => <label key={side} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${choices[row.target.id] === side ? "border-primary bg-primary/5" : ""}`}>
            <input type="radio" className="mt-1" name={`rate-${row.target.id}`} checked={choices[row.target.id] === side} onChange={() => { setChoices(previous => ({ ...previous, [row.target.id]: side })); setConfirmed(false); }} />
            <span className="min-w-0 break-words"><span className="mb-1 block text-xs font-medium">Keep {side === "target" ? targetName : sourceName}</span><Price row={row[side]} /></span>
          </label>)}</div>
        </fieldset>)}
      </div>
      {conflicts.length > 0 ? <>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed these choices. Remove the unselected overlapping prices from these rate cards.</label>
        <Button size="sm" disabled={busy || !confirmed || conflicts.some(row => !choices[row.target.id])} onClick={resolve}>{busy ? "Saving…" : "Save price choices and recheck merge"}</Button>
      </> : !error && <Button size="sm" variant="outline" onClick={onResolved}>No overlapping prices — recheck merge</Button>}
    </>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {!loading && <Button size="sm" variant="outline" disabled={busy} onClick={() => setRevision(value => value + 1)}>Reload comparison</Button>}
  </section>;
}
