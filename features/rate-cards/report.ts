import type { ShortlistDocCreatorGroup } from "@/features/discovery/shortlists/export/shortlist-document";
import {renderCreatorListReport} from "@/features/discovery/shortlists/export/creator-list-html";
import {DELIVERABLE_TYPES_BY_PLATFORM} from "@/lib/campaigns/deliverable-taxonomy";
import {textFor,taxonomyLabel,type Language} from "./labels";
export type ClientRate={platform:string;deliverable:string;amount:number;currency:string;agency_fee_percent:number|null};
export type PublicPerformance={platform:string;followers:number|null;engagement:number|null;views:number|null;likes:number|null;comments:number|null;audienceCountry:string|null;profileUrl:string|null};
export type ReportCreator={group:ShortlistDocCreatorGroup;rates:ClientRate[];performance:PublicPerformance[]};
export type RateCardReport={name:string;version:string;client:string;brand:string|null;effective:string|null;expiry:string|null;creators:ReportCreator[]};
export type ReportTemplate="creator-list"|"creator-list-details";
export const escapeHtml=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function safeProfileUrl(value:string|null){try{const u=new URL(value??"");return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}
function chunk<T>(items:T[],size:number):T[][]{return Array.from({length:Math.max(1,Math.ceil(items.length/size))},(_,i)=>items.slice(i*size,(i+1)*size));}

/** The existing Shortlist Creator List template is the single layout source for all formats. */
export function buildRateCardReportHtml(doc:RateCardReport,template:ReportTemplate,lang:Language="en"){
 const t=(key:Parameters<typeof textFor>[1])=>textFor(lang,key),e=escapeHtml,details=template==="creator-list-details";
 const format=(v:number|null)=>v==null?"—":v.toLocaleString(lang,{maximumFractionDigits:2});
 const entries=doc.creators.flatMap(c=>{const rates=chunk(c.rates,3),metrics=chunk(c.performance,4);return Array.from({length:Math.max(rates.length,details?metrics.length:1)},(_,i)=>({...c,rates:rates[i]??[],performance:metrics[i]??[],continued:i>0}));});
 const creators=entries.map(c=>({name:c.group.creator,handle:c.group.handle,profileUrl:safeProfileUrl(c.group.profileUrl||c.group.platformLinks[0]?.url||null),portrait:c.group.avatarUrl,avatar:c.group.avatarUrl,categories:c.group.categories,tier:c.group.tier,markets:[c.group.country]}));
 const supplement=(_creator:unknown,index:number)=>{
  const c=entries[index];
  const prices=c.rates.map(r=>{const label=DELIVERABLE_TYPES_BY_PLATFORM[r.platform]?.find(d=>d.value===r.deliverable)?.label??r.deliverable;return `<div class="price"><span>${e(taxonomyLabel(r.platform,lang))} · ${e(taxonomyLabel(r.deliverable,lang,label))}</span><strong>${e(r.currency)} ${e(format(Number(r.amount)))}</strong>${r.agency_fee_percent!=null?`<small>${e(t("agencyFee"))}: ${e(format(r.agency_fee_percent))}% · ${e(t("totalWithFee"))}: ${e(r.currency)} ${e(format(Number(r.amount)*(1+r.agency_fee_percent/100)))}</small>`:""}</div>`;}).join("")||`<p>${e(t("priceNotSet"))}</p>`;
  const links=c.group.platformLinks.map(l=>{const url=safeProfileUrl(l.url);return url?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(l.label)}</a>`:"";}).filter(Boolean).join(" · ");
  const profile=creators[index].profileUrl;
  return `${profile?`<a class="rate-card-cover-link" href="${e(profile)}" target="_blank" rel="noopener noreferrer" aria-label="${e(c.group.creator)}"></a>`:""}<div class="rate-prices">${c.continued?`<small>${e(t("continued"))}</small>`:""}${prices}<nav>${links}</nav></div>`;
 };
 return renderCreatorListReport({name:`${doc.client}${doc.brand?` · ${doc.brand}`:""}`,reference:`${doc.name} · ${doc.version}`,issuedDate:`${t("effective")}: ${doc.effective??"—"} · ${t("expiry")}: ${doc.expiry??"—"}`,creators},{
  title:t(details?"creatorListDetails":"creatorList"),language:lang,cardsPerPage:details?1:6,uniqueCreators:doc.creators.length,cardSupplement:supplement,
  wrapCard:(card,_creator,index)=>{
   if(!details)return card;
   const c=entries[index];const metrics=c.performance.map(p=>{
    const pairs=[[t("followers"),format(p.followers)],[t("engagementRate"),p.engagement==null?"—":format(p.engagement)+"%"],[t("avgViews"),format(p.views)],[t("avgLikes"),format(p.likes)],[t("avgComments"),format(p.comments)],[t("audienceCountry"),p.audienceCountry??"—"]];
    return `<section><h3>${e(taxonomyLabel(p.platform,lang))}</h3><dl>${pairs.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></section>`;
   }).join("")||`<p>${e(t("noPerformance"))}</p>`;
   return `<div class="rate-detail-row">${card}<aside class="rate-performance"><h2>${e(t("performance"))}</h2><p>${e(c.group.country)} · ${e(c.group.tier)} · ${e(c.group.categories.join(" · "))}</p>${metrics}</aside></div>`;
  },
  closingContent:`<div class="end__hd"><span class="end__eye">${e(doc.name)} · ${e(doc.version)}</span><h1>${doc.creators.length} ${e(t("creators"))}</h1><p>${e(t("reportHelp"))}</p></div><div class="rate-closing-note">${e(t("client_price"))} · ${e(t("feesSeparate"))}</div>`,
  extraCss:`.creator-card{height:690px;position:relative}.rate-card-cover-link{position:absolute;inset:0;z-index:1}.rate-prices nav{position:relative;z-index:2}.page footer span:last-child{direction:ltr}.portrait{height:310px}.rate-prices{margin-top:8px;font-size:10px;direction:${lang==="ar"?"rtl":"ltr"}}.rate-prices p{white-space:normal;text-align:start}.price{display:grid;gap:3px;border-top:1px solid #e5e3ee;padding-top:6px;margin-top:6px;overflow-wrap:anywhere}.price strong{font-size:14px}.price small{font-size:9px;line-height:1.4;color:#666477}.rate-prices nav{margin-top:8px;font-size:10px;color:#6551ad}.creator-card>*{flex-shrink:0}.creator-categories{max-height:52px;overflow:hidden}.creator-label h2,.creator-label p{text-align:start}.cards{grid-template-columns:repeat(${details?1:6},minmax(0,1fr));min-height:720px}.rate-detail-row{display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px;direction:ltr}.rate-detail-row .creator-card,.rate-performance{direction:${lang==="ar"?"rtl":"ltr"}}.rate-performance{padding:25px;background:#fff;border-radius:13px;color:#080642;height:690px}.rate-performance h2{height:auto;text-align:start;font-size:24px;margin:0 0 12px}.rate-performance p{text-align:start;white-space:normal;font-family:inherit;margin-bottom:15px}.rate-performance section{border-top:1px solid #e5e3ee;padding:12px 0}.rate-performance h3{margin:0 0 12px;font-size:16px;color:#6551ad}.rate-performance dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0}.rate-performance dt{font-size:12px;color:#666477}.rate-performance dd{font-size:18px;font-weight:700;margin:4px 0}.rate-closing-note{margin-top:30px;color:#c4c1d6;font-size:18px}.end__hd p{white-space:normal}html[dir=rtl] .creator-identity{direction:rtl}@media screen and (max-width:900px){.cards{grid-template-columns:repeat(2,minmax(0,1fr));min-height:0}.creator-card{height:auto}.portrait{height:280px;aspect-ratio:auto}.rate-detail-row{grid-template-columns:1fr}.rate-performance{height:auto}.rate-performance dl{grid-template-columns:repeat(2,minmax(0,1fr))}${details?".cards{grid-template-columns:1fr}":""}}@media screen and (max-width:520px){.cards{grid-template-columns:1fr}}`
 });
}
