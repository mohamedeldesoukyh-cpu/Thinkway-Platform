"use client";
import {useState} from "react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import type {Lang} from "./types";
export function ReportPreviewDialog({url,title,lang,onClose}:{url:string;title:string;lang:Lang;onClose:()=>void}){
 const [loading,setLoading]=useState(true);const ar=lang==="ar";
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent showCloseButton={false} dir={ar?"rtl":"ltr"} className="rx rx-dialog rx-preview-dialog"><header className="rx-dr__h"><div><DialogTitle>{title}</DialogTitle><DialogDescription>{ar?"إغلاق المعاينة يعيدك إلى قائمة الأسعار.":"Closing this preview returns you to the rate card."}</DialogDescription></div><span className="rx-sp"/><Button variant="outline" onClick={onClose}>{ar?"العودة إلى قائمة الأسعار":"Back to rate card"}</Button></header>{loading&&<p role="status">{ar?"جارٍ تجهيز المعاينة…":"Preparing preview…"}</p>}<iframe title={title} src={url} onLoad={()=>setLoading(false)} referrerPolicy="same-origin"/></DialogContent></Dialog>;
}
