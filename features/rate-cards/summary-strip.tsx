"use client";
import {useEffect,useState} from "react";
import {getRateCardSummary} from "./actions";
import type {RateCardSummary} from "./summary";
import {useRateLanguage} from "./ui";
import {taxonomyLabel} from "./labels";
const platforms=[['instagram','IG'],['tiktok','TT'],['facebook','FB'],['youtube','YT'],['snapchat','SC'],['twitter','X'],['linkedin','LI']] as const;
export function RateSummaryStrip({versionId,updatedAt}:{versionId:string;updatedAt:string}){
 const {lang,t}=useRateLanguage();
 const [summary,setSummary]=useState<RateCardSummary|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;setSummary(null);setFailed(false);getRateCardSummary(versionId).then(value=>{if(live)setSummary(value);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[versionId,updatedAt]);
 const ar=lang==="ar";
 if(!summary)return <p className="text-xs text-muted-foreground" role="status">{failed?(ar?"تعذر تحميل ملخص بطاقة الأسعار":"Rate-card summary unavailable"):t("loading")}</p>;
 const number=(n:number)=>n.toLocaleString(lang==="ar"?"ar-EG-u-nu-latn":"en-GB");
 return <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={ar?"ملخص بطاقة الأسعار بالكامل":"Entire rate-card summary"}>
  <span className="rounded-full border bg-white px-3 py-1"><strong>{number(summary.creators)}</strong> {t("creators")}</span>
  <span className="rounded-full border bg-white px-3 py-1" title={ar?"يُحتسب كل مبدع مرة واحدة لكل منصة":"Each creator is counted once per platform"}><strong>{number(summary.accounts)}</strong> {ar?"حسابات المنصات":"Platform accounts"}</span>
  {platforms.filter(([key],i)=>i<3||summary.platforms[key]).map(([key,label])=><span key={key} className="rounded-full border bg-white px-3 py-1" title={taxonomyLabel(key,lang)}><strong>{number(summary.platforms[key]??0)}</strong> {label}</span>)}
 </div>;
}
