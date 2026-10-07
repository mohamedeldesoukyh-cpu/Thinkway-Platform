"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getCreatorMergeHistoryAction } from "./history-action";

const labels: Record<string, string> = { influencers: "Original creator profile", creator_dna: "Original creator intelligence", creator_crm_profiles: "Original commercial profile", rate_card_lines: "Previous rate-card price", rate_card_creator_avatars: "Previous rate-card photo", creator_intelligence_monthly_metrics: "Previous monthly metrics", creator_content_performance_baselines: "Previous performance baseline", creator_crm_activation_events: "Commercial history" };
export function CreatorMergeHistoryButton({ influencerId }: { influencerId: string }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getCreatorMergeHistoryAction>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true; setData(null); setError(null);
    void getCreatorMergeHistoryAction(influencerId, page).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Could not load history."); });
    return () => { active = false; };
  }, [open, influencerId, page]);
  return <><Button variant="outline" size="sm" onClick={() => { setPage(1); setOpen(true); }}>Merge history</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Preserved merge history</DialogTitle><DialogDescription>Linked jobs and documents remain in their original screens. Administrators can review previous profile details and overlapping snapshots here.</DialogDescription></DialogHeader>
      {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading…</p> : <>
        {data.rows.map(row => <details className="rounded-lg border p-3" key={row.id}><summary className="cursor-pointer text-sm font-medium">{labels[row.source_table] ?? "Previous record"} · {new Date(row.created_at).toLocaleDateString()}</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(row.record, null, 2)}</pre></details>)}
        {!data.rows.length && <p className="text-sm text-muted-foreground">No preserved merge snapshots available.</p>}
        {data.total > 20 && <div className="flex items-center justify-between"><Button variant="outline" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>{page} / {Math.ceil(data.total / 20)}</span><Button variant="outline" disabled={page * 20 >= data.total} onClick={() => setPage(value => value + 1)}>Next</Button></div>}
      </>}
    </DialogContent></Dialog></>;
}
