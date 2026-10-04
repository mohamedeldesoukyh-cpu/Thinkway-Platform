import {getReportPlatformIconDataUri} from "@/lib/performance/report/report-platform-icons";
import {EXTRA_RATE_TYPES,requiresPeriod,periodLabel} from "@/lib/quotations/commercial-period";
import type { ShortlistDocCreatorGroup } from "@/features/discovery/shortlists/export/shortlist-document";
import {renderCreatorListReport,CREATOR_LIST_PDF_OPTIONS} from "@/features/discovery/shortlists/export/creator-list-html";
import {DELIVERABLE_TYPES_BY_PLATFORM} from "@/lib/campaigns/deliverable-taxonomy";
import {textFor,taxonomyLabel,type Language} from "./labels";
import {packageDescription,type PackageDetails} from "./packages";
import {travelFields,type TravelUplifts} from "./travel";
export type ClientRate=TravelUplifts & {event_days?:number;package_key?:string;package_details?:PackageDetails|null;period_months?:number;platform:string;deliverable:string;amount:number;currency:string;agency_fee_percent:number|null};
export type PublicPerformance={platform:string;followers:number|null;engagement:number|null;views:number|null;likes:number|null;comments:number|null;audienceCountry:string|null;profileUrl:string|null};
export type ReportCreator={packageScopes?:PackageDetails[];group:ShortlistDocCreatorGroup;rates:ClientRate[];performance:PublicPerformance[]};
export type RateCardReport={name:string;version:string;client:string;brand:string|null;effective:string|null;expiry:string|null;creators:ReportCreator[]};
export type ReportTemplate="creator-list"|"creator-list-details";
export const escapeHtml=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function safeProfileUrl(value:string|null){try{const u=new URL(value??"");return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}
/** Package links are the offer scope, not every account ever saved on the creator. */
export function scopePackageReportCreator(c:ReportCreator):ReportCreator{
 const packages=[...c.rates.flatMap(r=>r.package_details?[r.package_details]:[]),...(c.packageScopes??[])];
 if(!packages.length||c.rates.some(r=>!r.package_details&&r.platform==="all"))return c;
 const profiles=[...new Map(packages.flatMap(p=>p.profiles).map(p=>[p.platform,p])).values()];
 const individualPlatforms=new Set(c.rates.filter(r=>!r.package_details).map(r=>r.platform));
 const links=[...profiles.map(p=>({platform:p.platform,url:p.profile_url,label:taxonomyLabel(p.platform,"en")})),...c.group.platformLinks.filter(l=>individualPlatforms.has(l.platform)&&!profiles.some(p=>p.platform===l.platform))];
 const performance=links.map(l=>c.performance.find(p=>p.platform===l.platform)??{platform:l.platform,followers:null,engagement:null,views:null,likes:null,comments:null,audienceCountry:null,profileUrl:l.url});
 return {...c,group:{...c.group,platformLinks:links,profileUrl:links[0]?.url??null,platform:links.map(l=>l.label).join(" · ")},performance};
}
export function rateReportLayout(doc:RateCardReport,template:ReportTemplate){
 const maxRates=Math.max(0,...doc.creators.map(c=>c.rates.length));
 if(template==="creator-list-details"){
  const maxPlatforms=Math.max(1,...doc.creators.map(c=>c.performance.length));
  const cardHeight=Math.max(340,150+Math.ceil(maxRates/3)*120+maxPlatforms*76+Math.max(0,...doc.creators.map(c=>travelFields.filter(f=>c.rates.some(r=>r[f.key]!=null)).length))*30);
  return {priceColumns:3,cardHeight,height:cardHeight*2+230,cardsPerPage:2};
 }
 const priceColumns=maxRates>4?2:1;
 const cardHeight=Math.max(690,320+Math.ceil(maxRates/priceColumns)*130+Math.max(0,...doc.creators.map(c=>travelFields.filter(f=>c.rates.some(r=>r[f.key]!=null)).length))*65,0);
 const height=cardHeight+210;
 return {priceColumns,cardHeight,height,cardsPerPage:maxRates>4?3:6};
}
export function rateReportPdfOptions(doc:RateCardReport,template:ReportTemplate){
 const {height}=rateReportLayout(doc,template);
 return {...CREATOR_LIST_PDF_OPTIONS,height:`${height}px`,viewport:{...CREATOR_LIST_PDF_OPTIONS.viewport,width:1600,height}};
}

/** The existing Shortlist Creator List template is the single layout source for all formats. */
export function buildRateCardReportHtml(doc:RateCardReport,template:ReportTemplate,lang:Language="en"){
 const t=(key:Parameters<typeof textFor>[1])=>textFor(lang,key),e=escapeHtml,details=template==="creator-list-details";
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
  const c=entries[index];const prices=details?"":priceMarkup(c);
  const links=c.group.platformLinks.map(l=>{const url=safeProfileUrl(l.url);return url?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${icon(l.platform)}${e(l.label)}</a>`:"";}).filter(Boolean).join(" · ");
  const profile=creators[index].profileUrl;
  return `${profile?`<a class="rate-card-cover-link" href="${e(profile)}" target="_blank" rel="noopener noreferrer" aria-label="${e(c.group.creator)}"></a>`:""}<div class="rate-prices"><div class="rate-price-grid">${prices}</div><nav>${links}</nav></div>`;
 };
 return renderCreatorListReport({name:`${doc.client}${doc.brand?` · ${doc.brand}`:""}`,reference:`${doc.name} · ${doc.version}`,issuedDate:`${t("effective")}: ${doc.effective??"—"} · ${t("expiry")}: ${doc.expiry??"—"}`,creators},{
  title:t(details?"creatorListDetails":"creatorList"),language:lang,cardsPerPage:layout.cardsPerPage,uniqueCreators:doc.creators.length,cardSupplement:supplement,
  wrapCard:(card,_creator,index)=>{
   if(!details)return card;
   const c=entries[index];const metrics=c.performance.map(p=>{
    const pairs=[[t("followers"),followers(p.followers)],[t("engagementRate"),p.engagement==null?"—":format(p.engagement)+"%"],[t("avgViews"),format(p.views)],[t("avgLikes"),format(p.likes)],[t("avgComments"),format(p.comments)]];
    return `<section><h3>${icon(p.platform)}${e(taxonomyLabel(p.platform,lang))}</h3><dl>${pairs.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></section>`;
   }).join("")||`<p>${e(t("noPerformance"))}</p>`;
   return `<div class="rate-detail-row">${card}<aside class="rate-performance"><section class="rate-detail-prices"><h2>${lang==="ar"?"بطاقة الأسعار":"Rate card"}</h2><div class="rate-price-grid">${priceMarkup(c)}</div></section><h2>${e(t("performance"))}</h2><p>${e(c.group.country)} · ${e(c.group.tier)} · ${e(c.group.categories.join(" · "))}</p>${metrics}</aside></div>`;
  },
  closingContent:`<div class="end__hd"><span class="end__eye">${e(doc.name)} · ${e(doc.version)}</span><h1>${doc.creators.length} ${e(t("creators"))}</h1><p>${e(t("reportHelp"))}</p></div><div class="rate-closing-note">${e(t("client_price"))} · ${e(t("feesSeparate"))}</div>`,
  extraCss:`.travel-uplifts{grid-column:1/-1;border-top:1px solid #e5e3ee;margin-top:8px;padding-top:6px;font-size:11px}.travel-uplift{margin-top:4px}.travel-uplift small{display:block}.package-price-label{color:#bf146f}.rate-platform-icon{display:inline-block;width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-inline-end:5px;border:0;border-radius:0;background:transparent;box-shadow:none}.rate-performance h3 .rate-platform-icon{width:24px;height:24px}@page{size:1600px ${layout.height}px}.page{height:${layout.height}px}.rate-price-grid{display:grid;grid-template-columns:repeat(${layout.priceColumns},minmax(0,1fr));gap:0 12px}.creator-card{height:${layout.cardHeight}px;position:relative}.rate-card-cover-link{position:absolute;inset:0;z-index:1}.rate-prices nav{position:relative;z-index:2}.page footer span:last-child{direction:ltr}.portrait{height:180px}.rate-prices{margin-top:8px;font-size:10px;direction:${lang==="ar"?"rtl":"ltr"}}.rate-prices p{white-space:normal;text-align:start}.price{display:grid;gap:3px;border-top:1px solid #e5e3ee;padding-top:6px;margin-top:6px;overflow-wrap:anywhere}.price strong{font-size:14px}.price small{font-size:9px;line-height:1.4;color:#666477}.rate-prices nav{margin-top:8px;font-size:10px;color:#6551ad}.creator-card>*{flex-shrink:0}.creator-categories{max-height:52px;overflow:hidden}.creator-label h2,.creator-label p{text-align:start}.cards{grid-template-columns:repeat(${layout.cardsPerPage},minmax(0,1fr));min-height:${layout.cardHeight+30}px}.rate-detail-row{display:grid;grid-template-columns:${layout.priceColumns>1?560:300}px minmax(0,1fr);gap:24px;direction:ltr}.rate-detail-row .creator-card,.rate-performance{direction:${lang==="ar"?"rtl":"ltr"}}.rate-performance{padding:25px;background:#fff;border-radius:13px;color:#080642;height:${layout.cardHeight}px}.rate-performance h2{height:auto;text-align:start;font-size:24px;margin:0 0 12px}.rate-performance p{text-align:start;white-space:normal;font-family:inherit;margin-bottom:15px}.rate-performance section{border-top:1px solid #e5e3ee;padding:12px 0}.rate-performance h3{margin:0 0 12px;font-size:16px;color:#6551ad}.rate-performance dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0}.rate-performance dt{font-size:12px;color:#666477}.rate-performance dd{font-size:18px;font-weight:700;margin:4px 0}.rate-closing-note{margin-top:30px;color:#c4c1d6;font-size:18px}.end__hd p{white-space:normal}html[dir=rtl] .creator-identity{direction:rtl}${details?`.cards{grid-template-columns:1fr;gap:18px;min-height:0}.rate-detail-row{grid-template-columns:220px minmax(0,1fr);gap:16px}.rate-detail-row .creator-card{padding:10px}.rate-detail-row .portrait{height:145px}.rate-detail-row .creator-label h2{font-size:15px}.rate-detail-row .creator-label p{font-size:10px}.rate-detail-row .creator-categories{max-height:40px}.rate-performance{padding:16px}.rate-performance h2{font-size:18px;margin:0 0 6px}.rate-performance p{font-size:11px;margin-bottom:8px}.rate-performance section{padding:7px 0}.rate-performance h3{font-size:12px;margin:0 0 5px}.rate-performance h3 .rate-platform-icon{width:18px;height:18px}.rate-performance dl{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.rate-performance dt{font-size:10px}.rate-performance dd{font-size:14px;margin:2px 0}.rate-performance .rate-detail-prices{border-top:0;padding-top:0;margin-bottom:12px}.rate-detail-prices .price{margin:0;padding:5px 0}.rate-detail-prices .price>span{font-size:10px}.rate-detail-prices .price strong{font-size:13px}.rate-detail-prices .price small{font-size:9px}.rate-detail-prices h2{font-size:16px;margin:0 0 5px;color:#bf146f}.rate-detail-prices .rate-price-grid{gap:4px 14px}`:""} @media screen and (max-width:900px){.page{height:auto}.cards{grid-template-columns:repeat(2,minmax(0,1fr));min-height:0}.creator-card{height:auto}.portrait{height:280px;aspect-ratio:auto}.rate-detail-row{grid-template-columns:1fr}.rate-performance{height:auto}.rate-performance .rate-price-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rate-performance dl{grid-template-columns:repeat(2,minmax(0,1fr))}${details?".cards{grid-template-columns:1fr}":""}}@media screen and (max-width:520px){.cards{grid-template-columns:1fr}}`
 });
}
