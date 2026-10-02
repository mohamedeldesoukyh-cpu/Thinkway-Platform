"use client";
import type {RateLine} from "./model";
import {rateTemplateRows,type RatePair} from "./template-rows";
import {Button} from "@/components/ui/button";
import {cell,useRateLanguage} from "./ui";
import {taxonomyLabel} from "./labels";

export function ServiceRateTable({lines,avatars,editable,selected,onSelect,onEdit,onAvatar}:{
 lines:RateLine[];avatars:Record<string,string>;editable:boolean;selected:Set<string>;
 onSelect:(ids:string[])=>void;onEdit:(line:Partial<RateLine>)=>void;onAvatar:(line:RateLine)=>void;
}){
 const {lang,t}=useRateLanguage();const ar=lang==="ar";
 const headers=[t("select"),t("creator"),t("platform"),t("deliverable"),t("creator_cost"),ar?"عملة المبدع":"Creator Currency",t("client_price"),ar?"عملة العميل":"Client Currency","GP %",ar?"الهامش ٪":"Margin / Markup %",t("agencyFee"),t("notes"),ar?"حقوق الاستخدام · تكلفة شهرية":"Usage Rights Monthly Creator Cost",ar?"حقوق الاستخدام · سعر العميل الشهري":"Usage Rights Monthly Client Price",ar?"مدة حقوق الاستخدام بالشهور":"Usage Rights Period (Months)",ar?"الترويج · تكلفة شهرية":"Boosting Monthly Creator Cost",ar?"الترويج · سعر العميل الشهري":"Boosting Monthly Client Price",ar?"مدة الترويج بالشهور":"Boosting Period (Months)",ar?"حضور الفعالية · تكلفة المبدع":"Event Attendance Creator Cost",ar?"حضور الفعالية · سعر العميل":"Event Attendance Client Price",t("action")];
 const pct=(n:number|null|undefined)=>n==null?"—":Number(n).toFixed(2)+"%";
 const periods=(pair:RatePair)=>pair.cost&&pair.client&&pair.cost.period_months!==pair.client.period_months?`${t("creator_cost")}: ${pair.cost.period_months} / ${t("client_price")}: ${pair.client.period_months}`:pair.client?.period_months??pair.cost?.period_months??"—";
 return <><p className="rc-client-legend"><span/>{ar?"الخلايا الرمادية تعرض بيانات تظهر للعميل في المعاينة والتقارير. التكاليف الداخلية ونسب الربح لا تظهر للعميل.":"Light grey cells identify client-facing report fields. Internal costs, GP and markup remain private."}</p><div className="rc-service-scroll rounded-lg border"><table className="rc-service-table rc-template-table"><thead><tr>{headers.map((h,i)=><th className={cell} key={i}>{h}</th>)}</tr></thead><tbody>
 {rateTemplateRows(lines).map(row=>{
  const price=(rate:RateLine|undefined,type:"creator_cost"|"client_price",deliverable:string,enabled=true)=> <td className={`${cell} ${type==="client_price"?"rc-client-field":""}`}><div className="whitespace-nowrap font-medium">{rate?`${Number(rate.amount).toLocaleString(lang)} ${rate.currency}`:"—"}</div>{editable&&enabled&&<Button size="sm" variant="ghost" aria-label={`${t(rate?"edit":"add")} ${t(type)} · ${row.line.creator_name} · ${taxonomyLabel(deliverable,lang)}`} onClick={()=>onEdit(rate??{...row.line,id:undefined,deliverable,price_type:type,amount:undefined,period_months:["usage_right","boosting"].includes(deliverable)?1:0})}>{rate?t("edit"):(ar?"إضافة":"Add")}</Button>}</td>;
  const all=[row.base.cost,row.base.client,row.usage.cost,row.usage.client,row.boost.cost,row.boost.client,row.event.cost,row.event.client].filter((r):r is RateLine=>!!r);
  const fees=[row.base.client,row.usage.client,row.boost.client,row.event.client].filter((r):r is RateLine=>!!r);
  const differentFees=new Set(fees.map(r=>r.agency_fee_percent)).size>1;
  return <tr key={row.key}>
   <td className={cell}><input type="checkbox" aria-label={`${t("select")} ${row.line.creator_name} ${row.type}`} checked={row.ids.every(id=>selected.has(id))} onChange={()=>onSelect(row.ids)}/></td>
   <td className={`${cell} rc-client-field`}><div className="rc-creator-cell">{avatars[row.line.creator_ref]&&<img src={avatars[row.line.creator_ref]} alt=""/>}<strong>{row.line.creator_name}</strong></div></td>
   <td className={`${cell} rc-client-field`}>{taxonomyLabel(row.line.platform,lang)}</td><td className={`${cell} rc-client-field`}>{taxonomyLabel(row.type,lang)||"—"}</td>
   {price(row.base.cost,"creator_cost",row.type,!!row.type)}<td className={cell}>{row.base.cost?.currency??"—"}</td>
   {price(row.base.client,"client_price",row.type,!!row.type)}<td className={`${cell} rc-client-field`}>{row.base.client?.currency??"—"}</td>
   <td className={cell}>{pct((row.base.client??row.base.cost)?.gp_percent)}</td><td className={cell}>{pct((row.base.client??row.base.cost)?.markup_percent)}</td>
   <td className={`${cell} rc-client-field`}>{differentFees?fees.map(r=><div key={r.id}>{taxonomyLabel(r.deliverable,lang)}: {pct(r.agency_fee_percent)}</div>):pct(fees[0]?.agency_fee_percent)}</td>
   <td className={cell}>{[...new Set(all.map(r=>r.notes).filter(Boolean))].join(" · ")}</td>
   {price(row.usage.cost,"creator_cost","usage_right",row.includeExtras)}{price(row.usage.client,"client_price","usage_right",row.includeExtras)}<td className={`${cell} rc-client-field`}>{periods(row.usage)}</td>
   {price(row.boost.cost,"creator_cost","boosting",row.includeExtras)}{price(row.boost.client,"client_price","boosting",row.includeExtras)}<td className={`${cell} rc-client-field`}>{periods(row.boost)}</td>
   {price(row.event.cost,"creator_cost","event_attendance",row.includeExtras)}{price(row.event.client,"client_price","event_attendance",row.includeExtras)}
   <td className={cell}>{editable&&<Button size="sm" variant="outline" onClick={()=>onAvatar(row.line)}>{t("avatar")}</Button>}</td>
  </tr>;
 })}
 </tbody></table>{!lines.length&&<p className="p-6 text-center">{t("noLines")}</p>}</div></>;
}
