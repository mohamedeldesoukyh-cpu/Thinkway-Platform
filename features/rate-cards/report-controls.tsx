"use client";
import {Button} from "@/components/ui/button";
import {useRateLanguage} from "./ui";
export function ReportControls({versionId}:{versionId:string}){
  const {lang,t}=useRateLanguage();
  const url=(template:string,format:string,download=false)=>`/api/rate-cards/${versionId}/export?template=${template}&lang=${lang}&format=${format}&download=${download?1:0}`;
  return <div className="grid gap-4 md:grid-cols-2">{(["creator-list","creator-list-details"] as const).map(template=>{
    const details=template==="creator-list-details";
    return <section key={template} className="space-y-4 rounded-lg border bg-white p-4" aria-label={t(details?"creatorListDetails":"creatorList")}>
      <h3 className="font-semibold">{t(details?"creatorListDetails":"creatorList")}</h3>
      <div className={`rc-template-preview ${details?"rc-template-preview-details":""}`} aria-hidden="true"><div className="rc-template-creator"><div/><span>{t("creator")}</span><small>{t("client_price")}</small></div>{details?<div className="rc-template-performance"><strong>{t("performance")}</strong><span>{t("followers")} · {t("engagementRate")}</span><span>{t("avgViews")} · {t("avgLikes")} · {t("avgComments")}</span></div>:<><div className="rc-template-creator"><div/><span>{t("creator")}</span><small>{t("client_price")}</small></div><div className="rc-template-creator"><div/><span>{t("creator")}</span><small>{t("client_price")}</small></div></>}</div>
      <p className="text-sm text-muted-foreground">{details?(lang==="ar"?"عرض قائمة: بطاقة المبدع يساراً وبطاقة أداء المنصات بجانبها، تشمل المتابعين والتفاعل والمشاهدات والإعجابات والتعليقات.":"List view: creator card on the left, with a platform performance card beside it showing followers, engagement, views, likes and comments."):(lang==="ar"?"قالب بطاقات المبدعين الحالي مع أسعار العميل أسفل الصورة.":"The current creator-card template, with client prices below each photo.")}</p>
      <div className="flex flex-wrap gap-2"><Button asChild><a href={url(template,"html")} target="_blank" rel="noopener noreferrer">{t("preview")}</a></Button>{["html","pdf","pptx"].map(format=><Button variant="outline" key={format} asChild><a href={url(template,format,true)} target="_blank" rel="noopener noreferrer">{t("download")} {format.toUpperCase()}</a></Button>)}</div>
    </section>;
  })}</div>;
}
