"use client";
import {useRef,type ReactNode} from "react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {rxText} from "./labels";
import type {Lang} from "./types";
import "./redesign.css";

export function RateLanguage({lang,onChange}:{lang:Lang;onChange:(lang:Lang)=>void}){
 return <div className="rx-lang" role="group" aria-label="Language">{(["en","ar"] as const).map(l=><button key={l} aria-pressed={lang===l} onClick={()=>onChange(l)}>{l==="en"?"EN":"العربية"}</button>)}</div>;
}
/** Rate-card-only Radix overlay: focus trap, Escape and focus return are retained. */
export function RateOverlay({title,description,lang,onClose,children,drawer=true,busy=false}:{title:string;description:string;lang:Lang;onClose:()=>void;children:ReactNode;drawer?:boolean;busy?:boolean}){
 const returnFocus=useRef<HTMLElement|null>(null);
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent showCloseButton={false} dir={lang==="ar"?"rtl":"ltr"} lang={lang} className={`rx rx-dialog ${drawer?"rx-drawer":"rx-confirm"}`} onOpenAutoFocus={()=>{returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}} onCloseAutoFocus={e=>{e.preventDefault();returnFocus.current?.focus();}} onInteractOutside={e=>{if(busy)e.preventDefault();}} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}>
  <header className="rx-dr__h"><div><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></div><span className="rx-sp"/><Button variant="ghost" disabled={busy} onClick={onClose} aria-label={rxText(lang,"close2")}>×</Button></header>
  <div className="rx-dr__b">{children}</div><footer className="rx-dr__f"><span className="rx-sp"/><Button variant="outline" disabled={busy} onClick={onClose}>{rxText(lang,"close2")}</Button></footer>
 </DialogContent></Dialog>;
}
export function RateSkeleton(){return <div className="rx-skel" role="status" aria-label="Loading">{Array.from({length:6},(_,i)=><s key={i}/>)}</div>;}
