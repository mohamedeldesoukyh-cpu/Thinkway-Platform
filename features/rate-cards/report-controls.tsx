"use client";
import {useState} from "react";
import {ReportPreviewDialog} from "./report-preview-dialog";
import {Button} from "@/components/ui/button";
import {useRateLanguage} from "./ui";
export function ReportControls({versionId}:{versionId:string}){
  const {lang,t}=useRateLanguage();const [preview,setPreview]=useState<{url:string;title:string}|null>(null);const [chosen,setChosen]=useState("creator-list");
  const url=(template:string,format:string,download=false)=>`/api/rate-cards/${versionId}/export?template=${template}&lang=${lang}&format=${format}&download=${download?1:0}`;
  return <div className="rx-report-choices">{(["creator-list","creator-list-details","client-list-by-name"] as const).map(template=>{
    const details=template==="creator-list-details",performanceOnly=template==="client-list-by-name";
    const title=t(performanceOnly?"clientListByName":details?"creatorListDetails":"creatorList");
    return <section key={template} className="rx-sec" aria-label={title}><label className="rx-report-option"><input type="radio" name="rate-report" checked={chosen===template} onChange={()=>setChosen(template)}/><strong>{title}</strong></label>
      
      <p className="text-sm text-muted-foreground">{performanceOnly?(lang==="ar"?"نفس ترتيب وبطاقات قائمة المبدعين، مع الأداء وروابط الحسابات فقط، دون أسعار أو أتعاب.":"The same creator cards and order, with performance and profile links only. No rates or fees."):details?(lang==="ar"?"عرض قائمة: بطاقة المبدع يساراً وبطاقة أداء المنصات بجانبها، تشمل المتابعين والتفاعل والمشاهدات والإعجابات والتعليقات.":"List view: creator card on the left, with a platform performance card beside it showing followers, engagement, views, likes and comments."):(lang==="ar"?"قالب بطاقات المبدعين الحالي مع أسعار العميل أسفل الصورة.":"The current creator-card template, with client prices below each photo.")}</p>
      {chosen===template&&<div className="flex flex-wrap gap-2"><Button onClick={()=>setPreview({url:url(template,"html"),title})}>{t("preview")}</Button>{["html","pdf","pptx"].map(format=><Button variant="outline" key={format} asChild><a href={url(template,format,true)} >{t("download")} {format.toUpperCase()}</a></Button>)}</div>}
    </section>;
  })}{preview&&<ReportPreviewDialog url={preview.url} title={preview.title} lang={lang} onClose={()=>setPreview(null)}/>}</div>;
}
