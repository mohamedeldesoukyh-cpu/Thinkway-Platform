"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, List, Save, Search, SlidersHorizontal, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { loadSavedCustomReports, saveCustomReport } from "../saved-custom-report-actions";
import { savedCustomReportUrl, type SavedCustomReport } from "@/lib/reports/custom/saved-custom-reports";

type Selection = Omit<SavedCustomReport, "id" | "name" | "favorite">;
export function SavedCustomReports({ selection, favoritesOnly = false, onLoad, compact = false, pending = false, renderActions, viewControls }: { selection?: Selection; favoritesOnly?: boolean; onLoad?: (report: SavedCustomReport) => void; compact?: boolean; pending?: boolean; viewControls?: ReactNode; renderActions?: (saveButton: ReactNode) => ReactNode }) {
  const [reports, setReports] = useState<SavedCustomReport[]>([]);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<SavedCustomReport | "new" | null>(null);
  const [name, setName] = useState("");
  const [favorite, setFavorite] = useState(true);
  const [manage, setManage] = useState(false), [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null), manageTrigger = useRef<HTMLButtonElement>(null);
  const load = async () => {
    setLoaded(false); setLoadError(false);
    try { const result = await loadSavedCustomReports(); if (result.ok) { setReports(result.reports); setMessage(""); } else { setLoadError(true); setMessage(result.message); } }
    catch { setLoadError(true); setMessage("Could not load saved reports. Please retry."); }
    finally { setLoaded(true); }
  };
  useEffect(() => {
    let active = true;
    loadSavedCustomReports().then(result => { if (!active) return; setLoaded(true); if (result.ok) setReports(result.reports); else { setLoadError(true); setMessage(result.message); } }).catch(() => { if (active) { setLoaded(true); setLoadError(true); setMessage("Could not load saved reports. Please retry."); } });
    return () => { active = false; };
  }, []);
  const persist = async (report: SavedCustomReport) => {
    setBusy(true); setMessage("");
    try { const result = await saveCustomReport(report); if (result.ok) { setReports(result.reports); setEditing(null); setMessage("Saved to your account."); } else setMessage(result.message); }
    catch { setMessage("Could not save the report. Please retry."); }
    finally { setBusy(false); }
  };
  const visible = reports.filter(r => !favoritesOnly || r.favorite).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  const openNew = () => { returnFocus.current = document.activeElement as HTMLElement; setName(""); setFavorite(true); setMessage(""); setEditing("new"); };
  const rename = (report: SavedCustomReport) => { returnFocus.current = manageTrigger.current; setManage(false); setEditing(report); setName(report.name); setFavorite(report.favorite); setMessage(""); };
  const saveDisabled = busy || pending || !loaded || loadError || !selection?.columns.length || reports.length >= 30;
  const saveButton = <button className="cr-button cr-save-button" aria-label="Save report" title={reports.length >= 30 ? "You can save up to 30 custom reports." : !selection?.columns.length ? "Add at least one column besides VAT before saving." : "Save current selection"} disabled={saveDisabled} onClick={openNew}><Save /><span>Save report</span></button>;
  const compactItem = (report: SavedCustomReport, full = false) => <li key={report.id} className={full ? "cr-saved-row" : "cr-saved-chip"}>
    <button className="cr-icon" disabled={busy} aria-label={`${report.favorite ? "Remove" : "Add"} ${report.name} ${report.favorite ? "from" : "to"} favorites`} aria-pressed={report.favorite} onClick={() => void persist({ ...report, favorite: !report.favorite })}><Star className={report.favorite ? "cr-starred" : ""} /></button>
    <div className="cr-saved-name"><a href={savedCustomReportUrl(report, true)} target="_blank" rel="noopener noreferrer" title={report.name}><span dir="auto">{report.name}</span><ExternalLink /></a>{full && <small>{report.columns.length + Number(report.includeVat)} columns · {report.currency} {report.includeVat ? "· VAT" : ""}</small>}</div>
    <button className="cr-customize" disabled={pending} onClick={() => { setManage(false); onLoad?.(report); }}><SlidersHorizontal />Customize</button>
    {full && <button className="cr-text-button" disabled={busy} aria-label={`Rename ${report.name}`} onClick={() => rename(report)}>Rename</button>}
  </li>;
  return <>{compact ? <section className="cr-saved-strip" aria-label="Saved custom reports"><div className="cr-saved-heading"><Star /><strong>Saved reports</strong><span>{reports.length}/30</span></div>
    {!loaded ? <p role="status">Loading saved reports…</p> : loadError ? <p role="alert">Could not load saved reports. <button className="cr-text-button" onClick={() => void load()}>Retry loading</button></p> : !visible.length ? <p>No saved reports yet. Build a report, then choose Save report below.</p> : <ul className="cr-saved-chips">{visible.map(report => compactItem(report))}</ul>}
    {viewControls}<button ref={manageTrigger} className="cr-text-button" disabled={!loaded || loadError} onClick={() => { setSearch(""); setManage(true); }}><List />Manage</button>
  </section> : <section className="space-y-3 rounded-xl border bg-card p-5" aria-label="Saved custom reports">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{favoritesOnly ? "Favorite custom reports" : "Saved custom reports"}</h2><p className="text-sm text-muted-foreground">Click a name to open its report with current data. Star reports to show them in Favorites.</p></div>
      {selection && <Button variant="outline" disabled={saveDisabled} onClick={openNew}>Save current selection</Button>}
    </div>
    {!loaded ? <p role="status" className="text-sm text-muted-foreground">Loading saved reports…</p> : !visible.length ? <p className="text-sm text-muted-foreground">{favoritesOnly ? "Star a saved custom report to see it here." : "No saved custom reports yet."}</p> : <ul className="grid gap-2 md:grid-cols-2">{visible.map(report => <li key={report.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <Button variant="ghost" className="size-11 p-0" disabled={busy} aria-label={`${report.favorite ? "Remove" : "Add"} ${report.name} ${report.favorite ? "from" : "to"} favorites`} aria-pressed={report.favorite} onClick={() => void persist({ ...report, favorite: !report.favorite })}><Star className={report.favorite ? "fill-current text-primary" : ""} aria-hidden /></Button>
      <a className="flex min-h-11 min-w-24 flex-1 items-center font-medium text-primary underline-offset-4 hover:underline" href={savedCustomReportUrl(report, true)} target="_blank" rel="noopener noreferrer">{report.name}</a>
      {onLoad ? <Button variant="ghost" onClick={() => onLoad(report)}>Customize</Button> : <Button variant="ghost" asChild><a href={savedCustomReportUrl(report)}>Customize</a></Button>}
      <Button variant="ghost" disabled={busy} aria-label={`Rename ${report.name}`} onClick={() => { setEditing(report); setName(report.name); setFavorite(report.favorite); }}>Rename</Button>
    </li>)}</ul>}
    {message && <p role="status" className="text-sm">{message} {message.includes("retry") && <Button variant="ghost" onClick={() => void load()}>Retry loading</Button>}</p>}
  </section>}
    {compact && message && !editing && <p className="cr-feedback" role="status">{message}</p>}
    {renderActions?.(saveButton)}
    <Dialog open={manage} onOpenChange={setManage}><DialogContent className="cr-dialog cr-manage-dialog" onCloseAutoFocus={event => { event.preventDefault(); manageTrigger.current?.focus(); }}><DialogHeader><DialogTitle>Saved custom reports</DialogTitle><DialogDescription>Click a name to open its report with current data. Customize loads its settings here. Star reports to show them in Favorites.</DialogDescription></DialogHeader>
      <label className="cr-search"><Search /><input autoFocus aria-label="Search saved reports" placeholder="Search saved reports…" value={search} onChange={e => setSearch(e.target.value)} /></label><ul className="cr-managed-list">{visible.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).map(report => compactItem(report, true))}</ul>{!visible.some(r => r.name.toLowerCase().includes(search.toLowerCase())) && <p>No matching saved reports.</p>}<div className="cr-dialog-footer"><span>{reports.length} of 30 saved</span><button className="cr-button" onClick={() => setManage(false)}>Close</button></div>
    </DialogContent></Dialog>
    <Dialog open={editing !== null} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent className={compact ? "cr-dialog" : undefined} showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }} onCloseAutoFocus={e => { if (returnFocus.current) { e.preventDefault(); returnFocus.current.focus(); } }}><DialogHeader><DialogTitle>{editing === "new" ? "Save custom report" : "Rename custom report"}</DialogTitle><DialogDescription>Your columns, filters, currency and VAT selection are saved to your account. Reports use current data when reopened.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!editing || !name.trim()) return; const source = editing === "new" ? selection : editing; if (source) void persist({ ...source, id: editing === "new" ? crypto.randomUUID() : editing.id, name: name.trim(), favorite }); }}>
        <label className="grid gap-2 text-sm font-medium">Report name<input autoFocus required disabled={busy} maxLength={80} value={name} onChange={e => setName(e.target.value)} className="min-h-11 rounded-lg border bg-background px-3" /><span className="text-xs text-muted-foreground">{name.length}/80 characters</span></label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" disabled={busy} className="size-5 accent-primary" checked={favorite} onChange={e => setFavorite(e.target.checked)} />Add to Favorites</label>
        {editing === "new" && selection && <p className="text-sm text-muted-foreground">{selection.columns.length + Number(selection.includeVat)} columns · {selection.currency} · VAT {selection.includeVat ? "included" : "off"}. Current filters and column order are included.</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save report"}</Button>
      </form>
    </DialogContent></Dialog>
  </>;
}
