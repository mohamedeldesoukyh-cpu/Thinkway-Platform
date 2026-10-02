"use client";
import { useEffect, useState } from "react";
import { rateCardAudit } from "./actions";
import { errorLabel, type Label } from "./labels";
import { Pager, cell, useRateLanguage } from "./ui";
export function RateCardAudit({versionId}:{versionId:string}) {
  const {t,lang}=useRateLanguage();const [open,setOpen]=useState(false);const [page,setPage]=useState(1);const [data,setData]=useState<Awaited<ReturnType<typeof rateCardAudit>>|null>(null);const [error,setError]=useState<Label|null>(null);
  useEffect(()=>{if(!open)return;let live=true;rateCardAudit(versionId,page).then(r=>{if(live){setData(r);setError(null);}}).catch(e=>live&&setError(errorLabel(e)));return()=>{live=false;};},[open,versionId,page]);
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer font-medium">{t("audit")}</summary>{error&&<p role="alert">{t(error)}</p>}{data&&<><div className="overflow-x-auto"><table className="w-full"><thead><tr>{["date","actor","action","version","before","after"].map(k=><th key={k} className={cell}>{t(k as Label)}</th>)}</tr></thead><tbody>{data.rows.map(r=><tr key={r.id} className="border-t"><td className={cell}>{new Date(r.created_at).toLocaleString(lang)}</td><td className={cell}><span dir="ltr">{r.actor_id}</span></td><td className={cell}>{t(r.action==="create"?"create":r.action==="delete"?"delete":"edit")}</td><td className={cell}>{String(r.metadata.version_id??"—")}</td><td className={cell}><details><summary>{t("view")}</summary><pre className="max-w-64 overflow-auto text-xs" dir="ltr">{JSON.stringify(r.old_data,null,2)}</pre></details></td><td className={cell}><details><summary>{t("view")}</summary><pre className="max-w-64 overflow-auto text-xs" dir="ltr">{JSON.stringify(r.new_data,null,2)}</pre></details></td></tr>)}</tbody></table></div><Pager page={page} total={data.total} size={25} onChange={setPage} t={t}/></>}</details>;
}
