"use client";
import {RateOverlay} from "./redesign-ui";
import {useRateLanguage} from "./ui";
import {rxText} from "./labels";
import type {RateLine} from "./model";
import {useState,useTransition} from "react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {applyRateTravelUplifts} from "./actions";
import {travelFields,travelSchema,type TravelUplifts} from "./travel";

export function TravelUpliftEditor({versionId,expected,editable,onSaved,creatorCount,lines}:{versionId:string;expected:string;editable:boolean;onSaved:()=>void;creatorCount:number;lines:RateLine[]}){
 const {lang,t}=useRateLanguage();const ar=lang==="ar";const tr=(k:Parameters<typeof rxText>[1])=>rxText(lang,k);
 const [values,setValues]=useState<Record<string,string>>({}),[open,setOpen]=useState(false),[confirm,setConfirm]=useState(false);const [busy,start]=useTransition();
 const parsed=travelSchema.safeParse(Object.fromEntries(Object.entries(values).filter(([,v])=>v.trim()).map(([k,v])=>[k,Number(v)])));
 const apply=()=>start(async()=>{if(!parsed.success)return;try{await applyRateTravelUplifts(versionId,parsed.data,expected);onSaved();setConfirm(false);setOpen(false);setValues({});toast.success(t("saved"));}catch{toast.error(ar?"تعذر الحفظ. تحقق من القيم أو حدّث الإصدار إذا تغيّر.":"Could not save. Check the values or refresh if this version changed.");}});
 const scope=ar?`تطبيق التعديلات على جميع المبدعين وعددهم ${creatorCount}؟`:`Apply travel uplifts to all ${creatorCount} creators?`;
 return <div className="rx-travel"><div className="rx-rail"><strong>{tr("tuT")}</strong>{travelFields.map(f=>{const distinct=[...new Set(lines.map(l=>l[f.key]??null))];return <span className="rx-tu__v" key={f.key}>{f.short} <b>{distinct.length===1?(distinct[0]==null?tr("notSet"):distinct[0]+"%"):(ar?"متفاوت":"Varies")}</b></span>;})}<small>{ar?"ملخص الصفحة الحالية":"Current-page summary"}</small><Button className="rx-b" variant="outline" disabled={!editable} aria-expanded={open} onClick={()=>setOpen(!open)}>{tr("tuEdit")}</Button></div>
 {open&&<div className="rx-tued"><h3>{tr("tuT")}</h3><p>{tr("tuP")}</p><div className="rx-tugrid">{travelFields.map((f,i)=><label key={f.key} className="rx-lbl">{f.short} % · {tr((["tuA","tuB","tuI"] as const)[i])}<Input type="number" min="0" max="10000" step="any" disabled={busy} value={values[f.key]??""} onChange={e=>setValues({...values,[f.key]:e.target.value})}/></label>)}</div><div className="rx-scopewarn"><div><b>{scope}</b>{tr("tuWarnB")}</div></div>{!parsed.success&&<p className="rx-err" role="alert">{ar?"أدخل نسباً بين 0 و10000.":"Enter percentages between 0 and 10000."}</p>}<Button disabled={busy||!parsed.success||!Object.values(values).some(v=>v.trim())} onClick={()=>setConfirm(true)}>{ar?`تطبيق على جميع المبدعين (${creatorCount})`:`Apply to all ${creatorCount} creators`}</Button></div>}
 {confirm&&<RateOverlay drawer={false} busy={busy} title={scope} description={tr("tuWarnB")} lang={lang} onClose={()=>setConfirm(false)}><p>{Object.entries(values).filter(([,v])=>v.trim()).map(([k,v])=>`${travelFields.find(f=>f.key===k)?.short}: ${v}%`).join(" · ")}</p><p>{tr("tuP")}</p><Button disabled={busy} onClick={apply}>{t(busy?"busy":"confirmApply")}</Button></RateOverlay>}
 </div>;
}

export function TravelUpliftCell({field,value,editable,onSave}:{field:typeof travelFields[number];value:number|null|undefined;editable:boolean;onSave:(values:TravelUplifts)=>Promise<void>}){
 const {lang,t}=useRateLanguage();const ar=lang==="ar";
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState("");const [busy,start]=useTransition();
 if(!editing)return <><div>{value==null?(ar?"غير محدد":"Not set"):`${Number(value).toLocaleString()}%`}</div>{editable&&<Button size="sm" variant="ghost" aria-label={`Edit ${field.label}`} onClick={()=>{setDraft(value==null?"":String(value));setEditing(true);}}>{t("edit")}</Button>}</>;
 return <form className="min-w-32 space-y-1" onSubmit={e=>{e.preventDefault();start(async()=>{try{if(!draft.trim()){setEditing(false);return;}const values=travelSchema.parse({[field.key]:Number(draft)});await onSave(values);setEditing(false);toast.success("Travel uplift saved.");}catch{toast.error("Could not save. Check the percentage or refresh this version.");}});}}><Input aria-label={field.label} type="number" min="0" max="10000" step="any" value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)}/><Button size="sm" disabled={busy} type="submit">{t("save")}</Button><Button size="sm" variant="ghost" disabled={busy} type="button" onClick={()=>setEditing(false)}>{t("cancel")}</Button></form>;
}
