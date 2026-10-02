import type { ShortlistDocCreatorGroup } from "@/features/discovery/shortlists/export/shortlist-document";
import {renderQuotationTemplateAvatarHtml} from "@/features/quotations/templates/quotation-template-avatars";
import {QUOTATION_TEMPLATE_STYLES} from "@/features/quotations/templates/quotation-template-styles";
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

/** One public projection and HTML layout feed preview, HTML, PDF and PPTX. */
export function buildRateCardReportHtml(doc:RateCardReport,template:ReportTemplate,lang:Language="en"){
  const t=(key:Parameters<typeof textFor>[1])=>textFor(lang,key),e=escapeHtml;
  const format=(v:number|null)=>v==null?"—":v.toLocaleString(lang,{maximumFractionDigits:2});
  const details=template==="creator-list-details";
  const title=t(details?"creatorListDetails":"creatorList");
  const entries=doc.creators.flatMap(c=>{
    const prices=chunk(c.rates,4),metrics=chunk(c.performance,4);
    return Array.from({length:Math.max(prices.length,details?metrics.length:1)},(_,i)=>({...c,rates:prices[i]??[],performance:metrics[i]??[],continued:i>0}));
  });
  const pages=chunk(entries,details?1:3);
  const renderCard=(c:typeof entries[number])=>{
    const profile=safeProfileUrl(c.group.profileUrl||c.group.platformLinks[0]?.url||null);
    const avatar=renderQuotationTemplateAvatarHtml({...c.group,profileUrl:profile},undefined,"showcase");
    const prices=c.rates.map(r=>{
      const label=DELIVERABLE_TYPES_BY_PLATFORM[r.platform]?.find(d=>d.value===r.deliverable)?.label??r.deliverable;
      return `<div class="price"><span>${e(taxonomyLabel(r.platform,lang))} · ${e(taxonomyLabel(r.deliverable,lang,label))}</span><strong>${e(r.currency)} ${e(format(Number(r.amount)))}</strong>${r.agency_fee_percent!=null?`<small>${e(t("agencyFee"))}: ${e(format(r.agency_fee_percent))}% · ${e(t("totalWithFee"))}: ${e(r.currency)} ${e(format(Number(r.amount)*(1+r.agency_fee_percent/100)))}</small>`:""}</div>`;
    }).join("")||`<p>${e(t("priceNotSet"))}</p>`;
    const card=`<div class="photo">${avatar}</div><div class="white-label"><h2>${e(c.group.creator)}</h2><span class="handle">${e(c.group.handle)}</span>${c.continued?`<small>${e(t("continued"))}</small>`:""}<div class="prices">${prices}</div></div>`;
    const links=c.group.platformLinks.map(l=>{const url=safeProfileUrl(l.url);return url?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(l.label)}</a>`:"";}).join(" · ");
    const performance=c.performance.map(p=>{
      const pairs=[[t("followers"),format(p.followers)],[t("engagementRate"),p.engagement==null?"—":format(p.engagement)+"%"],[t("avgViews"),format(p.views)],[t("avgLikes"),format(p.likes)],[t("avgComments"),format(p.comments)],[t("audienceCountry"),p.audienceCountry??"—"]];
      return `<section class="metric-platform"><h3>${e(taxonomyLabel(p.platform,lang))}</h3><dl>${pairs.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></section>`;
    }).join("")||`<p>${e(t("noPerformance"))}</p>`;
    return `<article class="creator-row"><div class="creator-card">${profile?`<a class="card-link" href="${e(profile)}" target="_blank" rel="noopener noreferrer">${card}</a>`:card}<nav>${links}</nav></div>${details?`<aside class="performance"><h2>${e(t("performance"))}</h2><p>${e(c.group.country)} · ${e(c.group.tier)} · ${e(c.group.categories.join(" · "))}</p>${performance}</aside>`:""}</article>`;
  };
  return `<!doctype html><html lang="${lang}" dir="${lang==="ar"?"rtl":"ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(doc.name)} · ${e(title)}</title><style>${QUOTATION_TEMPLATE_STYLES}
  @page{size:297mm 210mm;margin:0}body{background:#e9eef6}a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}.rcpage{width:297mm;height:210mm;margin:16px auto;background:white;padding:12mm 13mm;display:flex;flex-direction:column;overflow:hidden;break-after:page}.rcpage:last-child{break-after:auto}header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0057ff;padding-bottom:14px}header h1{font-size:24px;margin:0 0 5px}header p{font-size:12px;margin:4px 0}.brand{font-weight:850;color:#0057ff;font-size:22px}.rcgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:20px;flex:1;align-items:start}.rcgrid.details{display:block}.creator-row{min-width:0}.details .creator-row{display:grid;grid-template-columns:265px 1fr;gap:24px;direction:ltr}.creator-card{background:white;border:1px solid #e2e9f4;border-radius:14px;overflow:hidden;direction:${lang==="ar"?"rtl":"ltr"}}.photo{height:145px;background:#e8f5f0;display:flex;align-items:center;justify-content:center}.photo .sc-avatar{border-radius:0!important;width:100%!important;height:100%!important;object-fit:cover;display:flex;align-items:center;justify-content:center;font-size:70px;background:#e8f5f0}.white-label{padding:12px 14px;background:white;color:#0d1836}.white-label h2{font-size:17px;margin:0 0 3px;overflow-wrap:anywhere}.handle{color:#5a6780;font-size:12px}.price{border-top:1px solid #e2e9f4;margin-top:7px;padding-top:5px;font-size:10px;display:grid;gap:2px}.price strong{font-size:14px}.price small{font-size:9px;color:#5a6780}.creator-card nav{padding:0 14px 10px;font-size:11px;color:#0057ff}.performance{direction:${lang==="ar"?"rtl":"ltr"};background:#f4f7fd;border:1px solid #e2e9f4;border-radius:14px;padding:20px}.performance h2{font-size:20px;margin:0 0 8px}.performance p{font-size:12px;color:#5a6780;margin:0 0 12px}.metric-platform{border-top:1px solid #dce4f1;padding:8px 0}.metric-platform h3{font-size:13px;color:#0057ff;margin:0 0 6px}.metric-platform dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}.metric-platform dt{font-size:10px;color:#5a6780}.metric-platform dd{font-size:15px;margin:3px 0;font-weight:700}footer{font-size:10px;color:#5a6780;display:flex;justify-content:space-between;margin-top:8px}
  @media screen and (max-width:850px){.rcpage{width:100%;height:auto;min-height:100vh;margin:0;padding:22px}.rcgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.details .creator-row{grid-template-columns:1fr}.photo{height:240px}}@media screen and (max-width:520px){.rcgrid{grid-template-columns:1fr}}@media print{body{background:white}.rcpage{margin:0}}</style></head><body>${pages.map((page,i)=>`<section class="rcpage"><header><div><h1>${e(title)}</h1><p>${e(doc.name)} · ${e(doc.version)} · ${e(doc.client)}${doc.brand?` · ${e(doc.brand)}`:""}</p><p>${e(t("effective"))}: ${e(doc.effective??"—")} · ${e(t("expiry"))}: ${e(doc.expiry??"—")}</p></div><span class="brand">thinkway</span></header><main class="rcgrid ${details?"details":""}">${page.map(renderCard).join("")||`<p>${e(t("empty"))}</p>`}</main><footer><span>${e(t("client_price"))} · ${e(t("feesSeparate"))}</span><span>${i+1} / ${pages.length}</span></footer></section>`).join("")}</body></html>`;
}
