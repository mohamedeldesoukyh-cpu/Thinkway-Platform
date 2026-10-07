import ExcelJS from "exceljs";
import type {RateLine,RateVersion} from "./model";
import {rateTemplateRows} from "./template-rows";
import {packageDescription} from "./packages";
import {grossProfitPct,markupPct} from "./lib/pricing";
import {lineMoney} from "./offer-adapter";
import {styleRateWorkbook} from "./excel-style";

export type RateExcelAudience="client"|"internal";
const blue="FF0057FF",navy="FF0B0F1A";
/** Client mode projects an allowlist before making ANY worksheet, including metadata. */
export async function buildRateExcel(version:RateVersion,input:RateLine[],audience:RateExcelAudience,scope:string,lang:"en"|"ar"="en"){
 const internal=audience==="internal";
 const lines=internal?input:input.filter(l=>l.price_type==="client_price").map(l=>({id:l.id,version_id:l.version_id,creator_ref:l.creator_ref,creator_name:l.creator_name,platform:l.platform,deliverable:l.deliverable,amount:l.amount,currency:l.currency,price_type:l.price_type,agency_fee_percent:l.agency_fee_percent,period_months:l.period_months,event_days:l.event_days,package_key:l.package_key,package_details:l.package_details,tu_a_percent:l.tu_a_percent,tu_b_percent:l.tu_b_percent,itu_percent:l.itu_percent,notes:""}));
 const book=new ExcelJS.Workbook();book.creator="Thinkway";book.title=`${version.name} · ${version.version}`;book.created=new Date();book.calcProperties.fullCalcOnLoad=true;
 const cover=book.addWorksheet("Overview");cover.columns=[{width:28},{width:95}];cover.mergeCells("A1:B1");cover.getCell("A1").value=internal?"THINKWAY · INTERNAL RATE CARD":"THINKWAY · CLIENT RATE CARD";cover.getRow(1).height=38;cover.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:blue}};cover.getCell("A1").font={name:"Arial",size:20,bold:true,color:{argb:"FFFFFFFF"}};
 const metadata=[["Client",version.client_name],["Brand / scope",version.brand_name??"Client-level rate card"],["Rate card",version.name],["Version",version.version],["Status",version.status],["Effective date",version.effective_date??"Not set"],["Expiry date",version.expiry_date??"Not set"],["Export scope",scope],["Creators represented",new Set(input.map(l=>l.creator_ref)).size],["Pricing records",lines.length],["Exported at",new Date().toISOString()],["Source","Thinkway rate-card version"],["Pricing","Reference prices. Existing quotation prices are unaffected."],["Amounts","Currencies are retained as entered. No FX conversion or cross-currency totals."],["Missing and zero","Not set means no price. A numeric zero is an intentional price."],["Extras","Usage Rights and Boosting are monthly; Event Attendance is daily. Quantity totals exclude agency fees and travel."],["Travel uplifts","Optional percentages are separate from the base price. TU A: Alex / North Coast / Ain Sokhna. TU B: Red Sea / Sharm / Upper Egypt. ITU: International."],["Audience",internal?"Internal use only. Includes private creator costs, margins and notes.":"Client prices only. No internal commercial information."]];
 if(internal)metadata.push(["Internal version notes",version.notes??""]);
 for(const data of metadata){const row=cover.addRow(data);row.height=32;row.getCell(1).font={name:"Arial",bold:true,color:{argb:navy}};row.getCell(2).alignment={wrapText:true,vertical:"middle"};}
 // Retain offers whose client price is not entered yet. Only their public identity
 // is used here; costs and notes never enter a client worksheet.
 const groups=rateTemplateRows(internal?lines:input);
 const headers=["Creator","Included platforms","Offer / deliverable","Package composition",...(internal?["Creator cost","Creator currency"]:[]),"Client selling price","Client currency",...(internal?["GP %","Markup %"]:[]),"Content agency fee %"];
 for(const name of ["Usage Rights","Boosting","Event Attendance"]){if(internal)headers.push(`${name} creator rate`,`${name} creator currency`,`${name} creator quantity`);headers.push(`${name} client rate`,`${name} client currency`,`${name} client quantity`,`${name} client total`,`${name} agency fee %`);}
 headers.push("TU A %","TU B %","ITU %",...(internal?["Internal notes","Pricing line IDs"]:[]));
 const sheet=book.addWorksheet(internal?"Internal pricing table":"Client pricing table");sheet.addRow(headers);
 for(const row of groups){const base=row.base;const values:ExcelJS.CellValue[]=[row.line.creator_name,row.line.package_details?row.line.package_details.profiles.map(p=>p.platform).join(" · "):row.line.platform,row.line.package_details?.name??row.type,row.line.package_details?packageDescription(row.line.package_details,lang):"",...(internal?[base.cost?.amount??"Not set",base.cost?.currency??"Not set"]:[]),base.client?.amount??"Not set",base.client?.currency??"Not set"];
  if(internal){const gp=grossProfitPct(lineMoney(base.cost),lineMoney(base.client)),mk=markupPct(lineMoney(base.cost),lineMoney(base.client));const n=sheet.rowCount+1;values.push({formula:`IF(OR(NOT(ISNUMBER(E${n})),NOT(ISNUMBER(G${n})),F${n}<>H${n},G${n}=0),"—",(G${n}-E${n})/G${n})`,result:gp===null?"—":gp/100},{formula:`IF(OR(NOT(ISNUMBER(E${n})),NOT(ISNUMBER(G${n})),F${n}<>H${n},E${n}=0),"—",(G${n}-E${n})/E${n})`,result:mk===null?"—":mk/100});}
  values.push(base.client?.agency_fee_percent==null?"Not set":base.client.agency_fee_percent/100);
  for(const [pair,event] of [[row.usage,false],[row.boost,false],[row.event,true]] as const){const cq=pair.cost?(event?pair.cost.event_days??1:pair.cost.period_months??null):null,pq=pair.client?(event?pair.client.event_days??1:pair.client.period_months??null):null;if(internal)values.push(pair.cost?.amount??"Not set",pair.cost?.currency??"Not set",cq??"Not set");values.push(pair.client?.amount??"Not set",pair.client?.currency??"Not set",pq??"Not set");const n=sheet.rowCount+1,rateCol=sheet.getColumn(values.length-2).letter,qtyCol=sheet.getColumn(values.length).letter;values.push({formula:`IF(AND(ISNUMBER(${rateCol}${n}),ISNUMBER(${qtyCol}${n})),${rateCol}${n}*${qtyCol}${n},"Not set")`,result:pair.client&&pq!==null?pair.client.amount*pq:"Not set"},pair.client?.agency_fee_percent==null?"Not set":pair.client.agency_fee_percent/100);}
  values.push(...[row.line.tu_a_percent,row.line.tu_b_percent,row.line.itu_percent].map(n=>n==null?"Not set":n/100));if(internal)values.push([...new Set(lines.filter(l=>row.ids.includes(l.id)).map(l=>l.notes).filter(Boolean))].join(" · "),row.ids.join(", "));sheet.addRow(values);
 }
 // The complete source records retain per-service fees, quantities and currencies without blending.
 const detail=book.addWorksheet(internal?"All pricing records":"Client price details");detail.addRow(["Creator","Included platforms","Package","Deliverable",...(internal?["Rate type"]:[]),"Amount","Currency","Months","Event days","Agency fee %","TU A %","TU B %","ITU %",...(internal?["Internal notes","Record ID"]:[])]);
 for(const l of lines)detail.addRow([l.creator_name,l.package_details?.profiles.map(p=>p.platform).join(" · ")??l.platform,l.package_details?.name??"",l.deliverable,...(internal?[l.price_type]:[]),l.amount,l.currency,l.period_months||"Not set",l.deliverable==="event_attendance"?l.event_days??1:"Not applicable",...[l.agency_fee_percent,l.tu_a_percent,l.tu_b_percent,l.itu_percent].map(n=>n==null?"Not set":n/100),...(internal?[l.notes,l.id]:[])]);
 styleRateWorkbook(book,lang);
 return new Uint8Array(await book.xlsx.writeBuffer());
}
