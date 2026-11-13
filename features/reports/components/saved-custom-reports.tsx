"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { loadSavedCustomReports, saveCustomReport } from "../saved-custom-report-actions";
import { savedCustomReportUrl, type SavedCustomReport } from "@/lib/reports/custom/saved-custom-reports";

type Selection = Omit<SavedCustomReport, "id" | "name" | "favorite">;
export function SavedCustomReports({ selection, favoritesOnly = false, onLoad }: { selection?: Selection; favoritesOnly?: boolean; onLoad?: (report: SavedCustomReport) => void }) {
  const [reports, setReports] = useState<SavedCustomReport[]>([]);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<SavedCustomReport | "new" | null>(null);
  const [name, setName] = useState("");
  const [favorite, setFavorite] = useState(true);
  const load = async () => {
    const result = await loadSavedCustomReports(); setLoaded(true);
    if (result.ok) { setReports(result.reports); setMessage(""); } else setMessage(result.message);
  };
  useEffect(() => {
    let active = true;
    loadSavedCustomReports().then(result => { if (!active) return; setLoaded(true); if (result.ok) setReports(result.reports); else setMessage(result.message); }).catch(() => { if (active) { setLoaded(true); setMessage("Could not load saved reports. Please retry."); } });
    return () => { active = false; };
  }, []);
  const persist = async (report: SavedCustomReport) => {
    setBusy(true); setMessage("");
    try { const result = await saveCustomReport(report); if (result.ok) { setReports(result.reports); setEditing(null); setMessage("Saved to your account."); } else setMessage(result.message); }
    catch { setMessage("Could not save the report. Please retry."); }
    finally { setBusy(false); }
  };
  const visible = reports.filter(r => !favoritesOnly || r.favorite).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  return <section className="space-y-3 rounded-xl border bg-card p-5" aria-label="Saved custom reports">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{favoritesOnly ? "Favorite custom reports" : "Saved custom reports"}</h2><p className="text-sm text-muted-foreground">Click a name to open its report with current data. Star reports to show them in Favorites.</p></div>
      {selection && <Button variant="outline" disabled={busy || !loaded || !selection.columns.length} onClick={() => { setName(""); setFavorite(true); setEditing("new"); }}>Save current selection</Button>}
    </div>
    {!loaded ? <p role="status" className="text-sm text-muted-foreground">Loading saved reports…</p> : !visible.length ? <p className="text-sm text-muted-foreground">{favoritesOnly ? "Star a saved custom report to see it here." : "No saved custom reports yet."}</p> : <ul className="grid gap-2 md:grid-cols-2">{visible.map(report => <li key={report.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <Button variant="ghost" className="size-11 p-0" disabled={busy} aria-label={`${report.favorite ? "Remove" : "Add"} ${report.name} ${report.favorite ? "from" : "to"} favorites`} aria-pressed={report.favorite} onClick={() => void persist({ ...report, favorite: !report.favorite })}><Star className={report.favorite ? "fill-current text-primary" : ""} aria-hidden /></Button>
      <a className="flex min-h-11 min-w-24 flex-1 items-center font-medium text-primary underline-offset-4 hover:underline" href={savedCustomReportUrl(report, true)} target="_blank" rel="noopener noreferrer">{report.name}</a>
      {onLoad ? <Button variant="ghost" onClick={() => onLoad(report)}>Customize</Button> : <Button variant="ghost" asChild><a href={savedCustomReportUrl(report)}>Customize</a></Button>}
      <Button variant="ghost" disabled={busy} aria-label={`Rename ${report.name}`} onClick={() => { setEditing(report); setName(report.name); setFavorite(report.favorite); }}>Rename</Button>
    </li>)}</ul>}
    {message && <p role="status" className="text-sm">{message} {message.includes("retry") && <Button variant="ghost" onClick={() => void load()}>Retry loading</Button>}</p>}
    <Dialog open={editing !== null} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>{editing === "new" ? "Save custom report" : "Rename custom report"}</DialogTitle><DialogDescription>Your columns, filters, currency and VAT selection are saved to your account. Reports use current data when reopened.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!editing || !name.trim()) return; const source = editing === "new" ? selection : editing; if (source) void persist({ ...source, id: editing === "new" ? crypto.randomUUID() : editing.id, name: name.trim(), favorite }); }}>
        <label className="grid gap-2 text-sm font-medium">Report name<input autoFocus required maxLength={80} value={name} onChange={e => setName(e.target.value)} className="min-h-11 rounded-lg border bg-background px-3" /></label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={favorite} onChange={e => setFavorite(e.target.checked)} />Add to Favorites</label>
        {message && <p role="status" className="text-sm">{message}</p>}
        <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save report"}</Button>
      </form>
    </DialogContent></Dialog>
  </section>;
}
