"use client";
import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { QuotationDetail } from "@/features/quotations/types";
import { useQuotationManualSave } from "@/features/quotations/components/quotation-manual-save";
import { availableQuotationRates, quotationRateSources, previewQuotationRates, applyQuotationRates } from "./actions";
import type { RateVersion, RateTarget } from "./model";
import { errorLabel, taxonomyLabel, type Label } from "./labels";
import { Choice, Modal, Pager, cell, useRateLanguage } from "./ui";

const RateCardContext=createContext<{available:boolean;launch:(line:{item_id:string;index:number})=>void;sources:Awaited<ReturnType<typeof quotationRateSources>>}|null>(null);
export function QuotationLineRateCardButton({itemId,index,showButton=true}:{itemId:string;index:number;showButton?:boolean}) {
  const ctx=useContext(RateCardContext);const {t,lang}=useRateLanguage();
  if(!ctx)return null;
  const sourceMap=ctx.sources.find(s=>s.id===itemId)?.rate_card_sources;
  const lineSources=Object.entries(sourceMap??{}).filter(([key])=>key.split(":")[0]===String(index)).map(([,s])=>s);
  return <span className="inline-flex flex-wrap items-center gap-1">{showButton&&<Button type="button" size="sm" variant="ghost" disabled={!ctx.available} onClick={()=>ctx.launch({item_id:itemId,index})}>{t("apply")}</Button>}{lineSources.map(source=><details key={source.price_type} className="text-xs"><summary className="cursor-pointer">{t(source.price_type)} · {t(source.manual_override?"override":"source")}</summary><p>{source.name} · {source.version}</p><p>{t("original")}: {source.currency} {source.amount}</p><div>{source.components?.map((c,i)=><p key={i}>{taxonomyLabel(c.deliverable,lang)}: {source.currency} {c.monthly_amount} × {c.quantity}{c.period_months?` × ${c.period_months} ${t("period")}`:""} = {c.amount}</p>)}</div><p>{t("appliedDate")}: {new Date(source.applied_at).toLocaleString(lang)}</p></details>)}</span>;
}
export function QuotationRateCardTools({detail,children}:{detail:QuotationDetail;children:ReactNode}) {
  const {lang,t,change}=useRateLanguage();const router=useRouter();const manual=useQuotationManualSave();
  const [confirmLinked,setConfirmLinked]=useState(false);const [results,setResults]=useState<Awaited<ReturnType<typeof applyQuotationRates>>>([]);
  const [versions,setVersions]=useState<RateVersion[]>([]);const [sources,setSources]=useState<Awaited<ReturnType<typeof quotationRateSources>>>([]);
  const [open,setOpen]=useState(false);const [only,setOnly]=useState<{item_id:string;index:number}|undefined>();const [card,setCard]=useState("");const [version,setVersion]=useState("");const [target,setTarget]=useState<RateTarget|"">("");const [mode,setMode]=useState<"missing"|"overwrite">("missing");const [preview,setPreview]=useState<Awaited<ReturnType<typeof previewQuotationRates>>|null>(null);const [busy,start]=useTransition();const [page,setPage]=useState(1);const [linePage,setLinePage]=useState(1);
  useEffect(()=>{let live=true;Promise.all([availableQuotationRates(detail.id).catch(()=>[]),quotationRateSources(detail.id).catch(()=>[])]).then(([v,s])=>{if(live){setVersions(v);setSources(s);}}).catch(()=>{if(live){setVersions([]);setSources([]);}});return()=>{live=false;};},[detail.id,detail.client_id,detail.brand_id,detail.items]);
  function launch(line?:{item_id:string;index:number}) {if(manual.hasUnsavedChanges){toast.error(t("saveFirst"));return;}setResults([]);setConfirmLinked(false);setOnly(line);setCard("");setVersion("");setPreview(null);setMode("missing");setTarget("");setPage(1);setOpen(true);}
  const availableVersions=versions.filter(v=>v.client_id===detail.client_id&&(!v.brand_id||v.brand_id===detail.brand_id));
  const cards=[...new Map(availableVersions.map(v=>[v.card_id,v])).values()];
  const selected=versions.find(v=>v.id===version);
  const allLines=detail.items.flatMap(item=>item.deliverables.map((d,index)=>({item,d,index})));
  return <RateCardContext.Provider value={{available:!!availableVersions.length&&!busy,launch,sources}}><div className="flex h-full min-h-0 flex-col"><section dir={lang==="ar"?"rtl":"ltr"} className="mx-4 my-2 shrink-0 rounded-lg border bg-card p-3">
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={!availableVersions.length||busy} onClick={()=>launch()}>{t("apply")}</Button><span className="text-xs text-muted-foreground">{t("optional")}</span></div>
    <details className="mt-2"><summary className="cursor-pointer text-sm">{t("lineActions")}</summary><div className="overflow-x-auto"><table className="w-full"><thead><tr>{["creator","platform","deliverable","source","action"].map(k=><th key={k} className={cell}>{t(k as Label)}</th>)}</tr></thead><tbody>{allLines.slice((linePage-1)*25,linePage*25).map(({item,d,index})=>{return <tr className="border-t" key={`${item.id}:${index}`}><td className={cell}>{item.creator_name}</td><td className={cell}>{taxonomyLabel(d.platform??"",lang)}</td><td className={cell}>{taxonomyLabel(d.type??"",lang)}</td><td className={cell}><QuotationLineRateCardButton itemId={item.id} index={index} showButton={false}/></td><td className={cell}><Button size="sm" variant="outline" disabled={!versions.length||busy} onClick={()=>launch({item_id:item.id,index})}>{t("apply")}</Button></td></tr>;})}</tbody></table></div><Pager page={linePage} size={25} total={allLines.length} onChange={setLinePage} t={t}/></details>
    <Modal open={open} onClose={()=>{if(!busy)setOpen(false);}} title={t("apply")} description={t("noAuto")} lang={lang}>
      <Button className="w-fit" variant="ghost" onClick={()=>change(lang==="ar"?"en":"ar")}>{lang==="ar"?"English":"العربية"}</Button>
      <Choice label={t("name")} disabled={busy} value={card} onChange={v=>{setCard(v);setVersion("");setPreview(null);}} options={cards.map(v=>({value:v.card_id,label:`${v.name} · ${v.brand_name??t("clientLevel")}`}))}/>
      <Choice label={t("version")} disabled={busy} value={version} onChange={v=>{setVersion(v);setPreview(null);}} options={versions.filter(v=>v.card_id===card).map(v=>({value:v.id,label:`${v.version} · ${t(v.status)} · ${v.effective_date??"—"} · ${v.creator_count} ${t("creators")}`}))}/>
      {selected&&<p className="text-sm">{t("warningVersion")} {t("effective")}: {selected.effective_date??"—"} · {t("expiry")}: {selected.expiry_date??"—"}</p>}
      <Choice label={t("priceType")} value={target} disabled={busy} onChange={v=>{setTarget(v as RateTarget);setPreview(null);}} options={["creator_cost","client_price","both"].map(v=>({value:v,label:t(v as Label)}))}/>
      <Choice label={t("apply")} disabled={busy} value={mode} empty={false} onChange={v=>{setMode(v as "missing"|"overwrite");setPreview(null);}} options={[{value:"missing",label:t("missing")},{value:"overwrite",label:t("overwrite")}]}/>
      <Button disabled={!version||!target||busy} onClick={()=>start(async()=>{try{setConfirmLinked(false);setPreview(await previewQuotationRates(detail.id,version,mode,only,target as RateTarget));setPage(1);}catch(e){toast.error(t(errorLabel(e)));}})}>{t(busy?"loading":"preview")}</Button>
      {!!results.length&&<div role="status"><h3>{t("applicationResults")}</h3>{results.map(r=><p key={r.item_id}>{detail.items.find(i=>i.id===r.item_id)?.creator_name} · {t(r.ok?"applied":"notApplied")}{!r.ok?` · ${r.message??t("error")}`:""}</p>)}</div>}
      {preview&&<><div className="flex flex-wrap gap-3 rounded-lg bg-muted p-3 text-sm">{(["update","fill","unchanged","no_match"] as const).map(status=><span key={status}>{t(status)}: {preview.rows.filter(r=>r.status===status).length}</span>)}<strong>{t("affected")}: {new Set(preview.rows.filter(r=>r.status==="update"||r.status==="fill").map(r=>r.item_id+":"+r.index)).size}</strong></div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr>{["creator","platform","deliverable","priceType","quantity","before","after","agencyFee","status"].map(k=><th key={k} className={cell}>{t(k as Label)}</th>)}</tr></thead><tbody>{preview.rows.slice((page-1)*50,page*50).map(r=><tr key={`${r.item_id}:${r.index}:${r.price_type}`} className="border-t"><td className={cell}>{r.creator}</td><td className={cell}>{taxonomyLabel(r.platform??"",lang)}</td><td className={cell}>{taxonomyLabel(r.deliverable??"",lang)}{r.components?.map(c=><small className="block" key={c.rate_id}>{taxonomyLabel(c.deliverable,lang)}: {c.monthly_amount} × {c.quantity}{c.period_months?` × ${c.period_months} ${t("period")}`:""} = {c.amount}</small>)}</td><td className={cell}>{t(r.price_type)}</td><td className={cell}>{r.quantity}</td><td className={cell}>{r.before??"—"}</td><td className={cell}>{r.apply_amount?`${r.currency} ${r.after?.toLocaleString(lang)}`:"—"}</td><td className={cell}>{r.apply_fee?`${r.before_fee??"—"}% → ${r.after_fee}%`:"—"}</td><td className={cell}>{t(r.status)}</td></tr>)}</tbody></table></div><Pager page={page} total={preview.rows.length} size={50} onChange={setPage} t={t}/>
        {!!preview.linked.length&&<div className="rounded-lg border p-3">{preview.linked.some(l=>l.locked)?<p role="alert">{t("financeLocked")}</p>:<label className="flex items-center gap-2"><input type="checkbox" checked={confirmLinked} onChange={e=>setConfirmLinked(e.target.checked)}/>{t("linkedConfirmation")} · {preview.linked.map(l=>l.campaign).filter(Boolean).join(" · ")}</label>}</div>}
        <Button disabled={busy||preview.linked.some(l=>l.locked)||!!preview.linked.length&&!confirmLinked||!preview.rows.some(r=>r.status==="update"||r.status==="fill")} onClick={()=>start(async()=>{if(manual.hasUnsavedChanges){toast.error(t("saveFirst"));return;}try{const result=await applyQuotationRates(detail.id,version,mode,preview.fingerprint,only,target as RateTarget,confirmLinked);setResults(result);if(result.some(r=>!r.ok))toast.error(t("partial"));else toast.success(t("applied"));setPreview(null);router.refresh();}catch(e){toast.error(t(errorLabel(e)));setPreview(null);}})}>{t(busy?"busy":"confirmApply")}</Button>
      </>}
      <Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>{t("cancel")}</Button>
    </Modal>
  </section>{children}</div></RateCardContext.Provider>;
}
