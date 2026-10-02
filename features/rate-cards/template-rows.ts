import type {RateLine} from "./model";
const extras=new Set(["usage_right","boosting","event_attendance"]);
export type RatePair={cost?:RateLine;client?:RateLine};
export function rateTemplateRows(lines:RateLine[]){
 const creators=new Map<string,RateLine[]>();
 for(const line of lines){const key=JSON.stringify([line.creator_ref,line.platform]);creators.set(key,[...(creators.get(key)??[]),line]);}
 return [...creators.entries()].flatMap(([key,rates])=>{
   const types=[...new Set(rates.map(r=>r.deliverable).filter(t=>!extras.has(t)))].sort();
   if(!types.length)types.push("");
   const pair=(type:string):RatePair=>({cost:rates.find(r=>r.deliverable===type&&r.price_type==="creator_cost"),client:rates.find(r=>r.deliverable===type&&r.price_type==="client_price")});
   return types.map((type,index)=>({key:key+type,line:rates.find(r=>r.deliverable===type)??rates[0],type,base:pair(type),usage:index===0?pair("usage_right"):{},boost:index===0?pair("boosting"):{},event:index===0?pair("event_attendance"):{},includeExtras:index===0,ids:rates.filter(r=>r.deliverable===type||(index===0&&extras.has(r.deliverable))).map(r=>r.id)}));
 });
}
