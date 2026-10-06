import {rateReportPlatformIcon as getReportPlatformIconDataUri} from "./report-icons";
import {rateReportStyles,RATE_A4_HEIGHT} from "./report-styles";
import {clientListPerformanceStyles} from "./client-list-styles";
import {EXTRA_RATE_TYPES,requiresPeriod,periodLabel} from "@/lib/quotations/commercial-period";
import type { ShortlistDocCreatorGroup } from "@/features/discovery/shortlists/export/shortlist-document";
import {renderCreatorListReport,CREATOR_LIST_PDF_OPTIONS} from "@/features/discovery/shortlists/export/creator-list-html";
import {DELIVERABLE_TYPES_BY_PLATFORM} from "@/lib/campaigns/deliverable-taxonomy";
import {textFor,taxonomyLabel,type Language} from "./labels";
import {packageDescription,type PackageDetails} from "./packages";
import {travelFields,type TravelUplifts} from "./travel";
export type ClientRate=TravelUplifts & {event_days?:number;package_key?:string;package_details?:PackageDetails|null;period_months?:number;platform:string;deliverable:string;amount:number;currency:string;agency_fee_percent:number|null};
export type PublicPerformance={platform:string;followers:number|null;engagement:number|null;views:number|null;likes:number|null;comments:number|null;audienceCountry:string|null;profileUrl:string|null};
export type ReportCreator={platformScopes?:string[];packageScopes?:PackageDetails[];group:ShortlistDocCreatorGroup;rates:ClientRate[];performance:PublicPerformance[]};
export type RateCardReport={clientLogo?:string|null;name:string;version:string;client:string;brand:string|null;effective:string|null;expiry:string|null;creators:ReportCreator[]};
/** Report saved fees without assuming missing values mean zero. */
export function rateCardAgencyFeeSummary(doc:RateCardReport,lang:Language="en"):string {
 const fees=doc.creators.flatMap(c=>c.rates.map(r=>r.agency_fee_percent));
 const known=[...new Set(fees.filter((fee):fee is number=>fee!=null&&Number.isFinite(fee)))].sort((a,b)=>a-b);
 if(!known.length)return lang==="ar"?"غير محددة":"Not specified";
 const value=known.map(fee=>`${fee.toLocaleString(lang,{maximumFractionDigits:2})}%`).join(" / ");
 const varies=known.length>1?(lang==="ar"?"تختلف حسب البند":"varies by item"):"";
 const missing=fees.some(fee=>fee==null)?(lang==="ar"?"بعض البنود غير محددة":"some items not specified"):"";
 return [value,varies,missing].filter(Boolean).join(" · ");
}
export type ReportTemplate="creator-list"|"creator-list-details"|"client-list-by-name";
export const escapeHtml=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function safeProfileUrl(value:string|null){try{const u=new URL(value??"");return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}
/** Package links are the offer scope, not every account ever saved on the creator. */
export function scopePackageReportCreator(c:ReportCreator):ReportCreator{
 const packages=[...c.rates.flatMap(r=>r.package_details?[r.package_details]:[]),...(c.packageScopes??[])];
 if(!packages.length||c.platformScopes?.includes("all")||c.rates.some(r=>!r.package_details&&r.platform==="all"))return c;
 const profiles=[...new Map(packages.flatMap(p=>p.profiles).map(p=>[p.platform,p])).values()];
 const individualPlatforms=new Set([...(c.platformScopes??[]),...c.rates.filter(r=>!r.package_details).map(r=>r.platform)]);
 const links=[...profiles.map(p=>({platform:p.platform,url:p.profile_url,label:taxonomyLabel(p.platform,"en")})),...c.group.platformLinks.filter(l=>individualPlatforms.has(l.platform)&&!profiles.some(p=>p.platform===l.platform))];
 const performance=links.map(l=>c.performance.find(p=>p.platform===l.platform)??{platform:l.platform,followers:null,engagement:null,views:null,likes:null,comments:null,audienceCountry:null,profileUrl:l.url});
 return {...c,group:{...c.group,platformLinks:links,profileUrl:links[0]?.url??null,platform:links.map(l=>l.label).join(" · ")},performance};
}
export function rateReportLayout(doc:RateCardReport,template:ReportTemplate){
 const maxRates=Math.max(0,...doc.creators.map(c=>c.rates.length));
 const maxPlatforms=Math.max(1,...doc.creators.map(c=>c.performance.length));
 if(template==="client-list-by-name")return {priceColumns:1,height:Math.max(900,690+maxPlatforms*110),cardsPerPage:6};
 const details=template==="creator-list-details";
 const maxUplifts=Math.max(0,...doc.creators.map(c=>travelFields.filter(f=>c.rates.some(r=>r[f.key]!=null)).length));
 const packageSpace=doc.creators.some(c=>c.rates.some(r=>r.package_details))?80:0;
 const detailHeight=100+Math.ceil(maxRates/3)*80+maxPlatforms*70+maxUplifts*35+packageSpace;
 return {priceColumns:details?3:maxRates>4?2:1,height:RATE_A4_HEIGHT,cardsPerPage:details?(detailHeight>460?1:2):4};
}
export function rateReportPdfOptions(doc:RateCardReport,template:ReportTemplate){
 const {height}=rateReportLayout(doc,template);
 if(template==="client-list-by-name")return {...CREATOR_LIST_PDF_OPTIONS,height:`${height}px`,viewport:{...CREATOR_LIST_PDF_OPTIONS.viewport,width:1600,height:Math.ceil(height)}};
 return {...CREATOR_LIST_PDF_OPTIONS,width:"297mm",height:"210mm",viewport:{...CREATOR_LIST_PDF_OPTIONS.viewport,width:1600,height:Math.ceil(height)}};
}

/** The existing Shortlist Creator List template is the single layout source for all formats. */
export function buildRateCardReportHtml(doc:RateCardReport,template:ReportTemplate,lang:Language="en"){
 const t=(key:Parameters<typeof textFor>[1])=>textFor(lang,key),e=escapeHtml,details=template==="creator-list-details",performanceOnly=template==="client-list-by-name";
 const format=(v:number|null)=>v==null?"—":v.toLocaleString(lang,{maximumFractionDigits:2});
 const icon=(platform:string)=>{const src=getReportPlatformIconDataUri(platform);return src?`<img class="rate-platform-icon" src="${src}" alt="" />`:"";};
 const followers=(v:number|null)=>v==null?"—":v>=1e6?format(v/1e6)+"M":v>=1e3?format(v/1e3)+"K":format(v);
 const entries=doc.creators.map(scopePackageReportCreator);
 const layout=rateReportLayout({...doc,creators:entries},template);
 const creators=entries.map(c=>({name:c.group.creator,handle:c.group.handle,profileUrl:safeProfileUrl(c.group.profileUrl||c.group.platformLinks[0]?.url||null),portrait:c.group.avatarUrl,avatar:c.group.avatarUrl,categories:c.group.categories,tier:c.group.tier,markets:[c.group.country]}));
 const priceMarkup=(c:ReportCreator)=>{
  const prices=[...c.rates].sort((a,b)=>(a.package_key??"").localeCompare(b.package_key??"")||Number(b.deliverable==="package")-Number(a.deliverable==="package")).map(r=>{const label=DELIVERABLE_TYPES_BY_PLATFORM[r.platform]?.find(d=>d.value===r.deliverable)?.label??EXTRA_RATE_TYPES.find(t=>t.value===r.deliverable)?.label??r.deliverable;const months=requiresPeriod(r.deliverable)?r.period_months||1:1;const days=r.deliverable==="event_attendance"?r.event_days??1:1;const platforms=r.package_details?.profiles.map(p=>p.platform)??[...new Set([...c.group.platformLinks.map(p=>p.platform),...c.performance.map(p=>p.platform)])];return `<div class="price">${r.deliverable==="package"?`<strong class="package-price-label">${lang==="ar"?"سعر الباقة":"Package Price"}</strong>`:""}<span>${r.platform==="all"?platforms.map(icon).join(""):icon(r.platform)}${e(r.package_details?platforms.map(p=>taxonomyLabel(p,lang)).join(" · "):taxonomyLabel(r.platform,lang))} · ${e(r.deliverable==="package"?r.package_details!.name:taxonomyLabel(r.deliverable,lang,label))}</span>${r.deliverable==="package"?`<span>${e(packageDescription(r.package_details!,lang))}</span>`:""}<strong>${e(r.currency)} ${e(format(Number(r.amount)*months*days))}</strong>${requiresPeriod(r.deliverable)?`<small>${e(r.currency)} ${e(format(Number(r.amount)))} / ${lang==="ar"?"شهر":"month"} × ${e(periodLabel(months,lang))}</small>`:""}${r.deliverable==="event_attendance"?`<small>${e(r.currency)} ${e(format(Number(r.amount)))} / ${lang==="ar"?"يوم":"day"} × ${days} ${lang==="ar"?"أيام":days===1?"day":"days"}</small>`:""}${r.package_details&&r.deliverable!=="package"?`<small>${e(r.package_details.name)}</small>`:""}<small>${e(t("feesSeparate"))}</small></div>`;}).join("")||`<p>${e(t("priceNotSet"))}</p>`;
  const uplifts=[...new Map(c.rates.flatMap(r=>travelFields.filter(f=>r[f.key]!=null).map(f=>[`${r.package_key??""}:${r.platform}:${f.key}:${r[f.key]}`,`<div class="travel-uplift"><strong>${e(f.label)}: ${e(format(Number(r[f.key])))}%</strong>${r.package_details?`<small>${e(r.package_details.name)}</small>`:""}</div>`] as const))).values()].join("");
  return prices+(uplifts?`<div class="travel-uplifts"><small>Optional travel uplifts · not included in the base price</small>${uplifts}</div>`:"");
 };
 const supplement=(_creator:unknown,index:number)=>{
  const c=entries[index];const prices=details||performanceOnly?"":priceMarkup(c);
  const links=c.group.platformLinks.map(l=>{const url=safeProfileUrl(l.url);const p=c.performance.find(p=>p.platform===l.platform);const platformLink=url?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${icon(l.platform)}${e(l.label)}</a>`:`<span>${icon(l.platform)}${e(l.label)}</span>`;return details?platformLink:`<div class="rate-platform-summary">${platformLink}<small>${e(t("followers"))}: <b>${e(followers(p?.followers??null))}</b> · ER: <b>${p?.engagement==null?"—":e(format(p.engagement))+"%"}</b> · ${lang==="ar"?"متوسط الإعجابات":"Avg Likes"}: <b>${e(followers(p?.likes??null))}</b></small>${performanceOnly?`<small>${e(t("avgViews"))}: <b>${e(followers(p?.views??null))}</b> · ${e(t("avgComments"))}: <b>${e(followers(p?.comments??null))}</b></small>`:""}</div>`;}).filter(Boolean).join(details?" · ":"");
  const profile=creators[index].profileUrl;
  return `${profile?`<a class="rate-card-cover-link" href="${e(profile)}" target="_blank" rel="noopener noreferrer" aria-label="${e(c.group.creator)}"></a>`:""}<div class="rate-prices">${details||performanceOnly?"":`<h3 class="rate-list-heading rate-list-heading-prices">${lang==="ar"?"بطاقة الأسعار":"Rate card"}</h3>`}<div class="rate-price-grid">${prices}</div><nav>${details?"":`<h3 class="rate-list-heading">${lang==="ar"?"الأداء":"Performance"}</h3>`}${links}</nav></div>`;
 };
 return renderCreatorListReport({clientLogo:doc.clientLogo,name:doc.brand?.trim()||doc.client,reference:`${doc.name} · ${doc.version}`,issuedDate:`${t("effective")}: ${doc.effective??"—"} · ${t("expiry")}: ${doc.expiry??"—"}`,creators},{
  hideCoverReference:true,coverLogoOnRight:true,showClientLogoInHeader:true,platformIcon:getReportPlatformIconDataUri,title:t(performanceOnly?"clientListByName":details?"creatorListDetails":"creatorList"),language:lang,cardsPerPage:layout.cardsPerPage,uniqueCreators:doc.creators.length,cardSupplement:supplement,
  wrapCard:(card,_creator,index)=>{
   if(!details)return card;
   const c=entries[index];const metrics=c.performance.map(p=>{
    const pairs=[[t("followers"),followers(p.followers)],[t("engagementRate"),p.engagement==null?"—":format(p.engagement)+"%"],[t("avgViews"),format(p.views)],[t("avgLikes"),format(p.likes)],[t("avgComments"),format(p.comments)]];
    return `<section><h3>${icon(p.platform)}${e(taxonomyLabel(p.platform,lang))}</h3><dl>${pairs.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></section>`;
   }).join("")||`<p>${e(t("noPerformance"))}</p>`;
   return `<div class="rate-detail-row">${card}<aside class="rate-performance"><section class="rate-detail-prices"><h2>${lang==="ar"?"بطاقة الأسعار":"Rate card"}</h2><div class="rate-price-grid">${priceMarkup(c)}</div></section><h2>${e(t("performance"))}</h2><p>${e(c.group.country)} · ${e(c.group.tier)} · ${e(c.group.categories.join(" · "))}</p>${metrics}</aside></div>`;
  },
  coverSupplement:performanceOnly?"":`<div class="rate-cover-fees"><strong>${lang==="ar"?"أتعاب وكالة العميل":"Client Agency fees"}</strong><span>${e(rateCardAgencyFeeSummary(doc,lang))}</span><small>${e(t("feesSeparate"))}</small></div>`,
  closingContent:`<div class="end__hd"><span class="end__eye">${e(doc.name)} · ${e(doc.version)}</span><h1>${doc.creators.length} ${e(t("creators"))}</h1><p>${e(t(performanceOnly?"performanceReportHelp":"reportHelp"))}</p></div>${performanceOnly?"":`<div class="rate-closing-note">${e(t("client_price"))} · ${e(t("feesSeparate"))}</div>`}`,
  extraCss:performanceOnly?clientListPerformanceStyles(lang,layout.height):rateReportStyles(details,lang,layout.priceColumns)
 });
}
