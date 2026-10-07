import type {RateLine} from "./model";
import {rateTemplateRows,type RatePair} from "./template-rows";
import type {Offer,Platform} from "./types";
import type {Currency,Money,PeriodicPrice} from "./lib/pricing";
import {packageDescription} from "./packages";
export function lineMoney(line:RateLine|undefined):Money{return {amount:line?.amount??null,currency:(line?.currency as Currency)??null};}
function periodic(pair:RatePair,event=false):PeriodicPrice|null{
 if(!pair.cost&&!pair.client)return null;
 return {creator:lineMoney(pair.cost),client:lineMoney(pair.client),creatorQty:pair.cost?(event?pair.cost.event_days??1:pair.cost.period_months??null):null,clientQty:pair.client?(event?pair.client.event_days??1:pair.client.period_months??null):null,agencyFeePct:pair.client?.agency_fee_percent??null};
}
/** Translate existing rows to the supplied contract; never generate a missing price. */
export function rateOffers(lines:RateLine[],avatars:Record<string,string>,lang:"en"|"ar"){
 return rateTemplateRows(lines).map(row=>{
  const offer:Offer={id:row.key,creatorId:row.line.creator_ref,creatorName:row.line.creator_name,creatorNameLocal:null,avatarUrl:avatars[row.line.creator_ref]??null,platforms:[...new Set(row.line.package_details?.profiles.map(p=>p.platform)??[row.line.platform])] as Platform[],deliverableType:row.type,packageCode:row.line.package_key??null,packageName:row.line.package_details?.name??null,composition:row.line.package_details?packageDescription(row.line.package_details,lang):null,pricingLineIds:row.ids,creatorCost:lineMoney(row.base.cost),clientPrice:lineMoney(row.base.client),agencyFeePct:row.base.client?.agency_fee_percent??null,notes:[...new Set(lines.filter(l=>row.ids.includes(l.id)).map(l=>l.notes).filter(Boolean))].join(" · ")||null,usageRights:periodic(row.usage),boosting:periodic(row.boost),eventAttendance:periodic(row.event,true),travel:{tuA:row.line.tu_a_percent??null,tuB:row.line.tu_b_percent??null,itu:row.line.itu_percent??null},rateCardPhotoUrl:null};return {offer,row};
 });
}
