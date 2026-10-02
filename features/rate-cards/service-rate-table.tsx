"use client";
import type {RateLine} from "./model";
import {rateServiceRows} from "./service-rows";
import {Button} from "@/components/ui/button";
import {cell,useRateLanguage} from "./ui";
import {taxonomyLabel,type Label} from "./labels";
import {requiresPeriod,periodLabel} from "@/lib/quotations/commercial-period";

export function ServiceRateTable({lines,avatars,editable,selected,onSelect,onEdit,onAvatar}:{
  lines:RateLine[];avatars:Record<string,string>;editable:boolean;selected:Set<string>;
  onSelect:(ids:string[])=>void;onEdit:(line:Partial<RateLine>)=>void;onAvatar:(line:RateLine)=>void;
}){
  const {lang,t}=useRateLanguage();
  const percent=(value:number|null|undefined)=>value==null?"—":Number(value).toFixed(2)+"%";
  return <div className="rc-service-scroll rounded-lg border"><table className="w-full rc-service-table"><thead><tr>{["select","creator","platform","deliverable","creator_cost","client_price","gp","markup","agencyFee","notes","action"].map(k=><th className={cell} key={k}>{t(k as Label)}</th>)}</tr></thead><tbody>
    {rateServiceRows(lines).map(({key,line,cost,client,ids})=><tr className="border-t" key={key}>
      <td className={cell}><input type="checkbox" aria-label={`${t("select")} ${line.creator_name} ${taxonomyLabel(line.deliverable,lang)}`} checked={ids.every(id=>selected.has(id))} onChange={()=>onSelect(ids)}/></td>
      <td className={cell}><div className="rc-creator-cell">{avatars[line.creator_ref]&&<img src={avatars[line.creator_ref]} alt=""/>}<strong>{line.creator_name}</strong></div></td>
      <td className={cell}>{taxonomyLabel(line.platform,lang)}</td><td className={cell}>{taxonomyLabel(line.deliverable,lang)}</td>
      {(["creator_cost","client_price"] as const).map(type=>{const rate=type==="creator_cost"?cost:client;return <td className={cell} key={type}><div className="whitespace-nowrap font-medium">{rate?`${Number(rate.amount).toLocaleString(lang)} ${rate.currency}`:"—"}</div>{rate&&requiresPeriod(rate.deliverable)&&<small className="block leading-5">{t("monthly")} × {periodLabel(rate.period_months||1,lang)}<br/>{t("periodTotal")}: {(rate.amount*(rate.period_months||1)).toLocaleString(lang)} {rate.currency}</small>}{editable&&<Button size="sm" variant="ghost" aria-label={`${t(rate?"edit":"add")} ${t(type)} · ${line.creator_name} · ${taxonomyLabel(line.deliverable,lang)}`} onClick={()=>onEdit(rate??{...line,id:undefined,price_type:type,amount:undefined})}>{t(rate?"edit":"add")}</Button>}</td>;})}
      <td className={cell}>{percent(line.gp_percent)}</td><td className={cell}>{percent(line.markup_percent)}</td><td className={cell}>{percent(client?.agency_fee_percent??cost?.agency_fee_percent)}</td>
      <td className={cell}>{[...new Set([cost?.notes,client?.notes].filter(Boolean))].join(" · ")}</td>
      <td className={cell}>{editable&&<Button size="sm" variant="outline" onClick={()=>onAvatar(line)}>{t("avatar")}</Button>}</td>
    </tr>)}
  </tbody></table>{!lines.length&&<p className="p-6 text-center">{t("noLines")}</p>}</div>;
}
