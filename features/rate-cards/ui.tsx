"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "./rate-cards.css";
import { textFor, type Label, type Language } from "./labels";
export function useRateLanguage() {
  const [lang,setLang]=useState<Language>("en");
  useEffect(()=>{const load=()=>setLang(localStorage.getItem("thinkway-rate-card-language")==="ar"||document.documentElement.lang==="ar"?"ar":"en");load();window.addEventListener("rate-card-language",load);return()=>window.removeEventListener("rate-card-language",load);},[]);
  function change(value:Language){localStorage.setItem("thinkway-rate-card-language",value);setLang(value);window.dispatchEvent(new Event("rate-card-language"));}
  const t=useCallback((key:Label)=>textFor(lang,key),[lang]);
  return {lang,t,change};
}
export function Field({label,children}:{label:string;children:ReactNode}) {return <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">{label}{children}</label>;}
export function Choice({label,value,onChange,options,disabled=false,empty=true}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];disabled?:boolean;empty?:boolean}) {return <Field label={label}><select aria-label={label} className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}>{empty&&<option value="">—</option>}{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>;}
export function TextField({label,value,onChange,type="text",disabled=false}:{label:string;value:string;onChange:(v:string)=>void;type?:string;disabled?:boolean}) {return <Field label={label}><Input className="h-11" type={type} step={type==="number"?"any":undefined} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}/></Field>;}
export function Modal({open,onClose,title,description,children,lang,headerAction,size="wide"}:{open:boolean;onClose:()=>void;title:string;description:string;children:ReactNode;lang:Language;headerAction?:ReactNode;size?:"wide"|"form"|"fullscreen"}) {return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent showCloseButton={false} dir={lang==="ar"?"rtl":"ltr"} className={`rate-card-suite rc-modal max-h-[90dvh] sm:max-w-6xl ${size==="form"?"rc-modal-form":size==="fullscreen"?"rc-modal-fullscreen":""}`}><DialogHeader className="rc-modal-heading"><div className="rc-title-row"><DialogTitle>{title}</DialogTitle>{headerAction}</div><DialogDescription>{description}</DialogDescription></DialogHeader><div className="rc-modal-body">{children}</div><footer className="rc-modal-footer"><Button variant="outline" onClick={onClose}>{textFor(lang,"close")}</Button></footer></DialogContent></Dialog>;}
export function Pager({page,total,size,onChange,t}:{page:number;total:number;size:number;onChange:(p:number)=>void;t:(k:Label)=>string}) {return <div className="flex items-center justify-end gap-3 py-3"><span className="text-sm tabular-nums">{page} / {Math.max(1,Math.ceil(total/size))} · {total}</span><Button variant="outline" disabled={page<=1} onClick={()=>onChange(page-1)}>{t("previous")}</Button><Button variant="outline" disabled={page*size>=total} onClick={()=>onChange(page+1)}>{t("next")}</Button></div>;}
export const cell="px-3 py-3 text-start align-top text-sm";
