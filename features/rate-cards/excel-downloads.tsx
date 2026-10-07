"use client";
import {useState} from "react";
import {Download} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {useRateLanguage} from "./ui";
export function ExcelDownloads({versionId,search="",platform="",currency=""}:{versionId:string;search?:string;platform?:string;currency?:string}){
 const {lang}=useRateLanguage();const ar=lang==="ar";const [busy,setBusy]=useState(false);
 const download=async(audience:"client"|"internal")=>{setBusy(true);try{const q=new URLSearchParams({audience,lang,...(audience==="internal"?{search,platform,currency}:{})});const response=await fetch(`/api/rate-cards/${versionId}/excel?${q}`);if(!response.ok){const r=await response.json().catch(()=>null);throw new Error(r?.error||(ar?"تعذر تنزيل الملف":"Could not download workbook"));}const url=URL.createObjectURL(await response.blob());const a=document.createElement("a");a.href=url;a.download=`rate-card-${audience}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){toast.error(e instanceof Error?e.message:"Could not download workbook");}finally{setBusy(false);}};
 return <DropdownMenu><DropdownMenuTrigger asChild><Button className="rx-b" variant="outline" disabled={busy} aria-label={ar?"تنزيل جدول الأسعار بصيغة Excel":"Download rate-card table as Excel"}><Download size={16}/>{busy?(ar?"جارٍ التجهيز…":"Preparing…"):"Excel"}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{ar?"تنزيل Excel":"Download Excel"}</DropdownMenuLabel><DropdownMenuItem onClick={()=>void download("client")}>{ar?"للعميل · كل الأسعار بدون تكاليف":"Client workbook · full version, client prices only"}</DropdownMenuItem><DropdownMenuItem onClick={()=>void download("internal")}>{ar?"داخلي · جميع الصفحات المطابقة للفلاتر":"Internal table · all filtered pages, all details"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
