import { computeCommercials } from "@/lib/commercial/commercial-engine";
import { computeDeliverableClientPrice, deliverableQuantity } from "@/lib/quotations/quotation-deliverable-commercial";
import type { ApplyRow, MatchItem } from "./model";

/** Build an immutable transaction snapshot. FX is resolved before any database write. */
export function buildAppliedCommercials(item: MatchItem & {cost_currency:string}, changes:ApplyRow[], fx:ReadonlyMap<string,number>) {
  const deliverables=structuredClone(item.deliverables);
  const convert=(value:number,from:string,to:string)=>{
    const a=fx.get(from),b=fx.get(to);if(!a||!b)throw new Error("currency");
    return value*a/b;
  };
  let cost=Number(item.cost??0),revenue=Number(item.revenue??0),fee=revenue*Number(item.af_pct??0)/100;
  for(const index of new Set(changes.map(r=>r.index))){
    const original=item.deliverables[index],draft=deliverables[index];
    const currency=original.cost_currency||item.cost_currency,qty=deliverableQuantity(original);
    const priorCost=original.cost==null&&deliverables.length===1?Number(item.cost??0):convert(Number(original.cost??0)*qty,currency,item.cost_currency);
    const hasRevenue=original.revenue!=null||original.free_for_client||original.cost!=null&&original.commercial_input_mode!=="cost_revenue";
    const priorRevenue=hasRevenue?convert(computeDeliverableClientPrice(original),currency,item.cost_currency):deliverables.length===1?Number(item.revenue??0):0;
    let nextRevenue=priorRevenue,nextFee=original.af_pct??item.af_pct??0;
    for(const row of changes.filter(r=>r.index===index)){
      if(row.price_type==="creator_cost"&&row.apply_amount){
        draft.cost=convert(row.after!,row.currency!,currency);
        cost+=convert(draft.cost*qty,currency,item.cost_currency)-priorCost;
      }
      if(row.price_type==="client_price"){
        if(row.apply_amount){nextRevenue=convert(row.after!*qty,row.currency!,item.cost_currency);draft.free_for_client=false;}
        if(row.apply_fee){nextFee=row.after_fee!;draft.af_pct=nextFee;}
      }
    }
    // Freeze an existing computed selling price before changing its cost basis.
    // An absent counterpart stays absent; no markup is implicitly generated.
    draft.revenue=hasRevenue||item.deliverables.length===1&&item.revenue!=null||changes.some(r=>r.index===index&&r.price_type==="client_price"&&r.apply_amount)
      ?convert(nextRevenue,item.cost_currency,currency):null;
    draft.cost_currency=currency;draft.commercial_input_mode="cost_revenue";
    const metrics=computeCommercials({mode:"cost_revenue",cost:Number(draft.cost??0)*qty,revenue:draft.revenue});
    draft.gp_pct=metrics.gpPct;draft.gp_value=metrics.gpValue/qty;
    revenue+=nextRevenue-priorRevenue;
    fee+=(nextRevenue*nextFee-priorRevenue*(original.af_pct??item.af_pct??0))/100;
  }
  return {deliverables,cost:Math.round(cost*10000)/10000,revenue:Math.round(revenue*10000)/10000,af_pct:revenue>0?fee/revenue*100:Number(item.af_pct??0)};
}
