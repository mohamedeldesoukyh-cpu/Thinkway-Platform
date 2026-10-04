"use client";
import {useState,useTransition} from "react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {applyRateTravelUplifts} from "./actions";
import {travelFields,travelSchema,type TravelUplifts} from "./travel";

export function TravelUpliftEditor({versionId,expected,editable,onSaved}:{versionId:string;expected:string;editable:boolean;onSaved:()=>void}){
 const [values,setValues]=useState<Record<string,string>>({});const [busy,start]=useTransition();
 return <section className="my-4 rounded-lg border bg-white p-4"><strong>Travel uplifts</strong><p className="mb-3 text-sm text-muted-foreground">Optional percentages, shown separately from the base price. Apply All updates every creator in this version, including other pages. Blank fields keep existing rates.</p><div className="flex flex-wrap items-end gap-3">{travelFields.map(f=><label key={f.key} className="text-sm font-medium">{f.short} %<Input aria-label={`${f.short} percentage`} type="number" min="0" max="10000" step="any" className="mt-1 w-32" disabled={!editable||busy} value={values[f.key]??""} onChange={e=>setValues({...values,[f.key]:e.target.value})}/></label>)}<Button disabled={!editable||busy||!Object.values(values).some(v=>v.trim())} onClick={()=>start(async()=>{try{const parsed=travelSchema.parse(Object.fromEntries(Object.entries(values).filter(([,v])=>v.trim()).map(([k,v])=>[k,Number(v)])));await applyRateTravelUplifts(versionId,parsed,expected);onSaved();toast.success("Travel uplifts applied to all creators.");}catch{toast.error("Could not save travel uplifts. Check the values or refresh if this version changed.");}})}>{busy?"Saving…":"Apply All"}</Button></div><div className="mt-3 text-xs text-muted-foreground">{travelFields.map(f=><p key={f.key}><b>{f.short}</b> — {f.label}</p>)}</div></section>;
}

export function TravelUpliftCell({field,value,editable,onSave}:{field:typeof travelFields[number];value:number|null|undefined;editable:boolean;onSave:(values:TravelUplifts)=>Promise<void>}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState("");const [busy,start]=useTransition();
 if(!editing)return <><div>{value==null?"—":`${Number(value).toLocaleString()}%`}</div>{editable&&<Button size="sm" variant="ghost" aria-label={`Edit ${field.label}`} onClick={()=>{setDraft(value==null?"":String(value));setEditing(true);}}>Edit</Button>}</>;
 return <form className="min-w-32 space-y-1" onSubmit={e=>{e.preventDefault();start(async()=>{try{const values=travelSchema.parse({[field.key]:draft.trim()?Number(draft):null});await onSave(values);setEditing(false);toast.success("Travel uplift saved.");}catch{toast.error("Could not save. Check the percentage or refresh this version.");}});}}><Input aria-label={field.label} type="number" min="0" max="10000" step="any" value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)}/><Button size="sm" disabled={busy} type="submit">Save</Button><Button size="sm" variant="ghost" disabled={busy} type="button" onClick={()=>setEditing(false)}>Cancel</Button></form>;
}
