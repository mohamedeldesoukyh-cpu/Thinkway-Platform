"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Save, Search, Settings, Star } from "lucide-react";
import "./custom-report-builder.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { loadSavedCustomReports, loadReportUsers, saveCustomReport, setCustomReportFavorite } from "../saved-custom-report-actions";
import { savedCustomReportUrl, type SavedCustomReport, type CustomReportSelection } from "@/lib/reports/custom/saved-custom-reports";

export function SavedCustomReports({ selection, favoritesOnly = false, onLoad, onSaved, onActiveFavoriteChange, activeId, compact = false, pending = false, renderActions, viewControls, previewRequest = 0, previewHref }: {
  selection?: CustomReportSelection; favoritesOnly?: boolean; onLoad?: (report: SavedCustomReport) => void; onSaved?: (report: SavedCustomReport) => void; onActiveFavoriteChange?: (favorite: boolean) => void; activeId?: string | null; compact?: boolean; pending?: boolean; viewControls?: ReactNode; renderActions?: (saveButton: ReactNode) => ReactNode; previewRequest?: number; previewHref?: string;
}) {
  const [reports, setReports] = useState<SavedCustomReport[]>([]), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [loadError, setLoadError] = useState(false);
  const [manage, setManage] = useState(false), [dismissedPreview, setDismissedPreview] = useState(0), [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SavedCustomReport | "new" | null>(null), [useSelection, setUseSelection] = useState(false);
  const [name, setName] = useState(""), [favorite, setFavorite] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "all" | "users">("private"), [sharedWith, setSharedWith] = useState<string[]>([]);
  const [users, setUsers] = useState<{id:string;name:string}[]>([]), [userSearch, setUserSearch] = useState(""), [userError, setUserError] = useState("");
  const picker = loaded && previewRequest > dismissedPreview;
  const closePicker = () => { setDismissedPreview(previewRequest); setSearch(""); };
  const reload = async () => { setLoadError(false); try { const result = await loadSavedCustomReports(); if (!result.ok) throw new Error(result.message); setReports(result.reports); setMessage(""); } catch { setLoadError(true); setMessage("Could not load saved reports. Please retry."); } finally { setLoaded(true); } };
  useEffect(() => {
    let alive = true;
    loadSavedCustomReports().then(result => { if (!alive) return; if(result.ok) setReports(result.reports); else {setLoadError(true);setMessage(result.message);} setLoaded(true); }).catch(() => { if(alive) {setLoaded(true);setLoadError(true);setMessage("Could not load saved reports. Please retry.");} });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!editing) return;
    let active = true;
    loadReportUsers().then(result => { if (!active) return; if (result.ok) { setUsers(result.users); setUserError(""); } else setUserError(result.message); }).catch(() => { if (active) setUserError("Could not load users. Close settings and retry."); });
    return () => { active = false; };
  }, [editing]);
  const active = reports.find(r => r.id === activeId);
  useEffect(() => { onActiveFavoriteChange?.(Boolean(active?.favorite)); }, [active?.favorite, onActiveFavoriteChange]);
  const visible = reports.filter(r => !favoritesOnly || r.favorite).sort((a,b) => Number(b.favorite)-Number(a.favorite) || a.name.localeCompare(b.name));
  const configure = (report: SavedCustomReport | "new", current = false) => {
    setEditing(report); setUseSelection(current); setManage(false); setMessage(""); setUserSearch("");
    setName(report === "new" ? "" : report.name); setFavorite(report === "new" ? false : report.favorite);
    setVisibility(report === "new" ? "private" : report.visibility ?? "private"); setSharedWith(report === "new" ? [] : report.sharedWith ?? []);
  };
  const toggleFavorite = async (report: SavedCustomReport) => {
    setBusy(true); try { const result=await setCustomReportFavorite(report.id,!report.favorite); if(result.ok) setReports(result.reports); else setMessage(result.message); } catch { setMessage("Could not update favorite. Please retry."); } finally { setBusy(false); }
  };
  const customize = (report: SavedCustomReport) => { setManage(false); if (onLoad) onLoad(report); else window.location.assign(savedCustomReportUrl(report)); };
  const save = async () => {
    if (!editing) return;
    const source = editing === "new" || useSelection ? selection : editing;
    if (!source) return;
    const report: SavedCustomReport = { ...source, id: editing === "new" ? crypto.randomUUID() : editing.id, name: name.trim(), favorite, visibility, sharedWith };
    setBusy(true); setMessage("");
    try { const result=await saveCustomReport(report); if(result.ok) { setReports(result.reports); setEditing(null); setMessage("Report saved."); if(selection && useSelection) onSaved?.(result.reports.find(r=>r.id===report.id) ?? report); } else setMessage(result.message); } catch {setMessage("Could not save the report. Please retry.");} finally {setBusy(false);}
  };
  const saveButton = <><button className="cr-button cr-save-button" disabled={busy || pending || !loaded || loadError || !selection?.columns.length} onClick={()=>configure(active?.canEdit ? active : "new",true)}><Save/><span>{active?.canEdit ? "Save changes" : "Save report"}</span></button>{active && <button className="cr-button" disabled={busy || pending || !selection?.columns.length} onClick={()=>configure("new",true)}>Save a copy</button>}</>;
  const item = (report: SavedCustomReport, full=false) => <li key={report.id} className={compact ? full ? "cr-saved-row" : "cr-saved-chip" : "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"}>
    <button className="cr-icon" disabled={busy} aria-label={`${report.favorite ? "Remove" : "Add"} ${report.name} ${report.favorite ? "from" : "to"} favorites`} aria-pressed={report.favorite} onClick={()=>void toggleFavorite(report)}><Star className={report.favorite ? "cr-starred fill-current text-primary" : ""}/></button>
    <div className="cr-saved-name flex-1"><a href={savedCustomReportUrl(report,true)} target="_blank" rel="noopener noreferrer"><span dir="auto">{report.name}</span><ExternalLink className="inline size-3"/></a>{full && <small className="block text-muted-foreground">{report.columns.length+Number(report.includeVat)} columns · {report.currency} · {report.visibility === "all" ? "All users" : report.visibility === "users" ? "Selected users" : "Private"}</small>}</div>
    <button className="cr-text-button" disabled={pending} onClick={()=>customize(report)}>{report.canEdit ? "Edit" : "Customize a copy"}</button>
    {report.canEdit && <button className="cr-text-button" disabled={busy} aria-label={`Settings for ${report.name}`} onClick={()=>configure(report)}><Settings className="size-4"/>Settings</button>}
  </li>;
  return <>
    <section className={compact ? "cr-saved-strip" : "space-y-3 rounded-xl border bg-card p-5"} aria-label="Saved custom reports">
      <div className="cr-saved-heading"><Star className="size-4"/><strong>{favoritesOnly ? "Favorite custom reports" : "Saved reports"}</strong><span>{reports.length}</span></div>
      {!loaded ? <p role="status">Loading saved reports…</p> : loadError ? <p role="alert">{message} <button onClick={()=>void reload()}>Retry</button></p> : !visible.length ? <p>{favoritesOnly ? "No favorite reports yet." : "No saved reports yet. Build a report, then save it."}</p> : <ul className={compact ? "cr-saved-chips" : "grid gap-2 md:grid-cols-2"}>{visible.map(r=>item(r,!compact))}</ul>}
      {viewControls}<button className="cr-text-button" disabled={!loaded || loadError} onClick={()=>{setSearch("");setManage(true);}}>Manage reports</button><a className="cr-text-button" href="/reports/settings"><Settings className="size-4"/>Report Settings</a>
    </section>
    {message && !editing && !loadError && <p role="status" className="cr-feedback">{message}</p>}
    {renderActions?.(<>{saveButton}<span className="hidden" data-active-favorite={active?.favorite ? "true" : "false"}/></>)}
    {/* Preview is opened synchronously by a link, so browsers do not block the new tab. */}
    <Dialog open={picker} onOpenChange={open=>{if(!open)closePicker();}}><DialogContent className="cr-dialog cr-manage-dialog"><DialogHeader><DialogTitle>Choose a saved report</DialogTitle><DialogDescription>Select a report to preview with current data.</DialogDescription></DialogHeader>
      <label className="cr-search"><Search/><input aria-label="Search reports to preview" placeholder="Search reports…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <ul className="cr-managed-list">{reports.filter(r=>r.name.toLowerCase().includes(search.toLowerCase())).map(r=><li key={r.id} className="cr-saved-row"><a className="cr-text-button" href={r.id===activeId && previewHref ? previewHref : savedCustomReportUrl(r,true)} target="_blank" rel="noopener noreferrer" onClick={closePicker}>{r.name}<ExternalLink/></a></li>)}</ul>
      {!reports.length && <p>Save your selection first, then choose it here.</p>}{!!reports.length && !reports.some(r=>r.name.toLowerCase().includes(search.toLowerCase())) && <p>No matching reports.</p>}
    </DialogContent></Dialog>
    <Dialog open={manage} onOpenChange={setManage}><DialogContent className="cr-dialog cr-manage-dialog"><DialogHeader><DialogTitle>Report Settings</DialogTitle><DialogDescription>Edit columns and filters, rename a report, or choose who can see it. Favorites belong to each user.</DialogDescription></DialogHeader>
      <label className="cr-search"><Search/><input aria-label="Search saved reports" placeholder="Search saved reports…" value={search} onChange={e=>setSearch(e.target.value)}/></label><ul className="cr-managed-list">{reports.filter(r=>r.name.toLowerCase().includes(search.toLowerCase())).map(r=>item(r,true))}</ul>
    </DialogContent></Dialog>
    <Dialog open={editing!==null} onOpenChange={open=>{if(!open&&!busy)setEditing(null);}}><DialogContent className="cr-dialog" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}}><DialogHeader><DialogTitle>{editing==="new" ? "Save report" : useSelection ? "Save changes" : "Report Settings"}</DialogTitle><DialogDescription>{useSelection ? "Save the current columns, filters, currency and VAT settings." : "Rename this report and choose who can see it. Use Edit to change its columns and filters."}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();void save();}}>
        <label className="grid gap-1">Report name<input className="rounded border p-2" required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="flex gap-2"><input type="checkbox" checked={favorite} onChange={e=>setFavorite(e.target.checked)}/>Add to my Favorites</label>
        <label className="grid gap-1">Who can see this report?<select className="rounded border p-2" value={visibility} onChange={e=>setVisibility(e.target.value as typeof visibility)}><option value="private">Only me</option><option value="all">All internal users with report access</option><option value="users">Specific users</option></select></label>
        {visibility==="users" && <fieldset><legend>Select users</legend><input className="w-full rounded border p-2" aria-label="Search report users" placeholder="Search users…" value={userSearch} onChange={e=>setUserSearch(e.target.value)}/><div className="max-h-48 overflow-y-auto">{users.filter(u=>u.name.toLowerCase().includes(userSearch.toLowerCase())).map(u=><label key={u.id} className="flex gap-2 py-1"><input type="checkbox" checked={sharedWith.includes(u.id)} onChange={e=>setSharedWith(e.target.checked ? [...sharedWith,u.id] : sharedWith.filter(id=>id!==u.id))}/>{u.name}</label>)}</div>{userError && <p role="alert">{userError}</p>}<small>{sharedWith.length} users selected</small></fieldset>}
        <p className="text-xs text-muted-foreground">Sharing a layout does not grant access to additional financial data. The owner and administrators can edit it.</p>
        {message && <p role="status">{message}</p>}<button className="cr-button primary" type="submit" disabled={busy || !name.trim() || (visibility==="users"&&!sharedWith.length)}>{busy ? "Saving…" : "Save report"}</button>
      </form>
    </DialogContent></Dialog>
  </>;
}
