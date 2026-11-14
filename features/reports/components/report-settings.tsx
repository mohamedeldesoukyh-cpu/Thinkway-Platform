"use client";
import { useState } from "react";
import { SavedCustomReports } from "./saved-custom-reports";
import { REPORT_HUB_LINKS } from "@/lib/reports/report-hub-links";
import { BUILTIN_REPORT_IDS, type BuiltinReportSettings } from "@/lib/reports/builtin-report-settings";
import { saveBuiltinReportSettings } from "../builtin-report-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "./custom-report-builder.css";
export function ReportSettings({ initial, admin, users }: {initial: BuiltinReportSettings[]; admin:boolean; users:{id:string;name:string}[]}) {
  const [settings,setSettings]=useState(initial), [editing,setEditing]=useState<BuiltinReportSettings|null>(null), [busy,setBusy]=useState(false), [message,setMessage]=useState(""), [search,setSearch]=useState("");
  const builtins=REPORT_HUB_LINKS.filter(r=>(BUILTIN_REPORT_IDS as readonly string[]).includes(r.id));
  const save=async()=>{if(!editing)return;setBusy(true);try{const result=await saveBuiltinReportSettings(editing);setMessage(result.message);if(result.ok){setSettings(old=>[...old.filter(r=>r.id!==editing.id),editing]);setEditing(null);}}catch{setMessage("Could not save settings. Please retry.");}finally{setBusy(false);}};
  return <div className="space-y-6"><SavedCustomReports/><section className="rounded-xl border bg-card p-5 space-y-3"><h2 className="font-semibold">Built-in reports</h2><p className="text-sm text-muted-foreground">Set the report name, description, default currency and who can open it. Existing filters and report calculations remain available on each report.</p>{!admin && <p>Administrators manage built-in report settings.</p>}
    {builtins.map(base=>{const saved=settings.find(r=>r.id===base.id);return <div key={base.id} className="flex items-center gap-3 rounded border p-3"><div className="flex-1"><strong>{saved?.name || base.title}</strong><p className="text-sm text-muted-foreground">{saved?.description ?? base.description}</p><small>{saved?.currency ?? "EGP"} · {saved?.visibility==="users" ? `${saved.shared_with.length} selected users` : "All users with report access"}</small></div><a className="cr-text-button" href={base.href}>Open report</a>{admin && <button className="cr-button" onClick={()=>{setMessage("");setSearch("");setEditing(saved ?? {id:base.id as BuiltinReportSettings["id"],name:base.title,description:base.description,currency:"EGP",visibility:"all",shared_with:[]});}}>Edit settings</button>}</div>;})}
    {message&&!editing&&<p role="status">{message}</p>}</section>
    <Dialog open={!!editing} onOpenChange={open=>{if(!open&&!busy)setEditing(null);}}><DialogContent className="cr-dialog"><DialogHeader><DialogTitle>Built-in report settings</DialogTitle><DialogDescription>These settings apply to everyone who can access this report. Administrators retain access.</DialogDescription></DialogHeader>{editing&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void save();}}>
      <label className="grid gap-1">Report name<input className="rounded border p-2" required maxLength={80} value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
      <label className="grid gap-1">Description<textarea className="rounded border p-2" maxLength={500} value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
      <label className="grid gap-1">Default currency<select className="rounded border p-2" value={editing.currency} onChange={e=>setEditing({...editing,currency:e.target.value as BuiltinReportSettings["currency"]})}>{["EGP","USD","AED","SAR"].map(c=><option key={c}>{c}</option>)}</select></label>
      <label className="grid gap-1">Who can see this report?<select className="rounded border p-2" value={editing.visibility} onChange={e=>setEditing({...editing,visibility:e.target.value as "all"|"users"})}><option value="all">All internal users with report access</option><option value="users">Specific users</option></select></label>
      {editing.visibility==="users"&&<fieldset><legend>Select users</legend><input className="rounded border p-2 w-full" placeholder="Search users…" aria-label="Search users" value={search} onChange={e=>setSearch(e.target.value)}/><div className="max-h-48 overflow-y-auto">{users.filter(u=>u.name.toLowerCase().includes(search.toLowerCase())).map(u=><label key={u.id} className="flex gap-2 py-1"><input type="checkbox" checked={editing.shared_with.includes(u.id)} onChange={e=>setEditing({...editing,shared_with:e.target.checked?[...editing.shared_with,u.id]:editing.shared_with.filter(id=>id!==u.id)})}/>{u.name}</label>)}</div></fieldset>}
      {message&&<p role="status">{message}</p>}<button type="submit" className="cr-button primary" disabled={busy || !editing.name.trim() || (editing.visibility==="users"&&!editing.shared_with.length)}>{busy?"Saving…":"Save settings"}</button>
    </form>}</DialogContent></Dialog>
  </div>;
}
