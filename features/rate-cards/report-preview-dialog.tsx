"use client";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {DocumentPreviewClient} from "@/features/discovery/document-preview/document-preview-client";
import type {Lang} from "./types";
export function ReportPreviewDialog({url,title,lang,onClose}:{url:string;title:string;lang:Lang;onClose:()=>void}){
 const ar=lang==="ar";
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent showCloseButton={false} dir={ar?"rtl":"ltr"} className="rx rx-dialog rx-preview-dialog !gap-0 !p-0 overflow-hidden"><DialogDescription className="sr-only">{ar?"معاينة التقرير":"Report preview"}</DialogDescription><DocumentPreviewClient contained src={url} title={title} toolbarLeft={<DialogTitle className="!text-xs !font-medium">{title}</DialogTitle>} toolbarRight={<Button variant="outline" onClick={onClose}>{ar?"العودة إلى قائمة الأسعار":"Back to rate card"}</Button>}/></DialogContent></Dialog>;
}
