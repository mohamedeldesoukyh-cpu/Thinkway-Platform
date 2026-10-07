import {packageDetailsSchema,parsePackageRow} from "./packages";
import {RATE_PLATFORM_OPTIONS,rateDeliverables,normalizeRatePlatform,genericRateDeliverable} from "./platforms";
import {EXTRA_RATE_TYPES,requiresPeriod,validPeriod,periodLabel} from "@/lib/quotations/commercial-period";
import {deliverableTypeLines,postTypePlatformKey} from "@/lib/quotations/quotation-deliverable-types";
import { z } from "zod";
import { DELIVERABLE_TYPES_BY_PLATFORM, canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { computeDeliverableClientPrice, deliverableQuantity } from "@/lib/quotations/quotation-deliverable-commercial";
import { computeCommercials } from "@/lib/commercial/commercial-engine";
import {importDiagnostic,numericImportDiagnostic,normalizeImportDecimal,packageImportDiagnostics,uniqueImportDiagnostics,type ImportDiagnostic} from "./import-diagnostics";

export type RateType = "creator_cost" | "client_price";
export type RateTarget = RateType | "both";

export const headerSchema = z.object({
  client_id: z.uuid(), brand_id: z.uuid().nullable(), name: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(50), status: z.enum(["active", "inactive"]),
  effective_date: z.iso.date().nullable(), expiry_date: z.iso.date().nullable(), notes: z.string().max(5000).default(""),
}).refine(v => !v.effective_date || !v.expiry_date || v.expiry_date >= v.effective_date, { message: "dates" });
export type HeaderInput = z.infer<typeof headerSchema>;
export const rateSchema = z.object({
  event_days: z.number().int().min(1).max(365).optional(),
  creator_ref: z.string().regex(/^(inf|dis):[0-9a-f-]{36}$/i), creator_name: z.string().max(300),
  platform: z.string(), deliverable: z.string(), amount: z.number().finite().min(0).max(999999999999),
  currency: z.string().regex(/^[A-Z]{3}$/), notes: z.string().max(5000).default(""),
  price_type: z.enum(["creator_cost", "client_price"]),
  package_key:z.string().regex(/^(?:[a-z0-9][a-z0-9_-]{0,49})?$/).optional(),
  package_details:packageDetailsSchema.nullable().optional(),
  period_months: z.number().int().min(0).max(120).optional(),
  agency_fee_percent: z.number().finite().min(0).max(100).nullable().default(null),
}).refine(v => ((v.deliverable==="package"&&!!v.package_details&&!!v.package_key)||rateDeliverables(v.platform).some(t => t.value === v.deliverable)||EXTRA_RATE_TYPES.some(t=>t.value===v.deliverable)) && (!requiresPeriod(v.deliverable)||validPeriod(v.period_months)), { message: "taxonomy" }).refine(v=>v.package_key ? !!v.package_details&&v.platform==="all"&&["package","usage_right","boosting","event_attendance"].includes(v.deliverable) : !v.package_details&&v.deliverable!=="package",{message:"package"});
export type RateInput = z.infer<typeof rateSchema>;
export type RateLine = RateInput & import("./travel").TravelUplifts & { id: string; version_id: string; creator_cost?:number|null; client_price?:number|null; creator_currency?:string|null; client_currency?:string|null; gp_percent?:number|null; markup_percent?:number|null };
export type RateVersion = HeaderInput & { id: string; card_id: string; created_at: string; updated_at: string; client_name: string; brand_name: string | null; creator_count: number; currencies: string[] };
export type RateSource = { card_id: string; version_id: string; name: string; version: string; amount: number; currency: string; applied_at: string; applied_by: string; applied_amount?: number; applied_currency?: string; manual_override?: boolean; price_type: RateType; application_mode?:"missing"|"overwrite"; components?:RateComponent[]; agency_fee_percent?:number|null };
export type MatchItem = { id: string; influencer_id?: string | null; profile_id?: string | null; unified_id?: string | null; creator_name?: string | null; cost?: number | null; revenue?: number | null; af_pct?: number | null; deliverables: QuotationDeliverable[] };
export type RateCardWriteSnapshot={quotationItemId:string;deliverables:QuotationDeliverable[];sources:Record<string,RateSource>;expectedDeliverables:QuotationDeliverable[];expectedCost:number|null;expectedRevenue:number;expectedCurrency:string};
export type RateComponent={rate_id:string;deliverable:string;quantity:number;period_months:number;monthly_amount:number;amount:number};
export type ApplyRow = { item_id: string; index: number; price_type: RateType; creator: string; platform: string; deliverable: string; quantity: number; before: number | null; after: number | null; currency: string | null; status: "update" | "fill" | "unchanged" | "no_match"; rate_id?: string; components?:RateComponent[]; apply_amount:boolean; before_fee:number|null; after_fee:number|null; apply_fee:boolean };
export function creatorRef(item: Pick<MatchItem, "influencer_id" | "profile_id" | "unified_id">) {
  return item.influencer_id ? `inf:${item.influencer_id}` : item.profile_id ? `dis:${item.profile_id}` : item.unified_id ?? "";
}
export function rateKey(ref: string, platform: string, deliverable: string, priceType:RateType,packageKey="") { return JSON.stringify([ref, canonicalPlatformKey(platform), deliverable, priceType,packageKey]); }
export function previewApplication(items: MatchItem[], rates: RateLine[], mode: "missing" | "overwrite", only?: { item_id: string; index: number }, target:RateTarget="creator_cost"): ApplyRow[] {
  const index = new Map<string, RateLine[]>();
  for (const r of rates.filter(r=>!r.package_key)) { const key = rateKey(r.creator_ref, r.platform, r.deliverable, r.price_type); index.set(key, [...(index.get(key) ?? []), r]); }
  return items.flatMap(item => item.deliverables.flatMap((d, i) => {
    if (only && (only.item_id !== item.id || only.index !== i)) return [];
    const scope=deliverableTypeLines(d);
    const targets:RateType[]=target==="both"?["creator_cost","client_price"]:[target];
    return targets.map(price_type=>{
      const components:RateComponent[]=[]; const matched:RateLine[]=[];
      for(const line of scope){
        const platform=scope.length===1?d.platform:postTypePlatformKey(line.type)||d.platform;
        const matches=index.get(rateKey(creatorRef(item),platform,line.type,price_type)) ?? index.get(rateKey(creatorRef(item),"all",line.type,price_type)) ?? index.get(rateKey(creatorRef(item),"all",genericRateDeliverable(line.type),price_type)) ?? [];
        if(matches.length!==1||requiresPeriod(line.type)&&!validPeriod(line.period_months))continue;
        const candidate=matches[0],months=requiresPeriod(line.type)?line.period_months!:1;
        matched.push(candidate);components.push({rate_id:candidate.id,deliverable:line.type,quantity:line.quantity,period_months:requiresPeriod(line.type)?months:0,monthly_amount:candidate.amount,amount:candidate.amount*months*line.quantity});
      }
      const complete=scope.length>0&&matched.length===scope.length&&new Set(matched.map(r=>r.currency)).size===1;
      const total=components.reduce((sum,c)=>sum+c.amount,0);
      const fees=matched.map(r=>r.agency_fee_percent);
      const fee=fees.every(f=>f!=null)?total?matched.reduce((sum,r,i)=>sum+components[i].amount*r.agency_fee_percent!,0)/total:fees[0]:null;
      const rate=complete?{...matched[0],amount:total,agency_fee_percent:fee}:undefined;
      const quantity=deliverableQuantity(d);
      // Zero is intentional. Protect line-master values and existing computed selling prices.
      const before=price_type==="creator_cost"
        ? d.cost ?? (item.deliverables.length===1 && item.cost!=null?item.cost/quantity:null)
        : d.free_for_client?0:d.revenue!=null?d.revenue/quantity:item.deliverables.length===1&&item.revenue!=null?item.revenue/quantity:d.cost!=null&&d.commercial_input_mode!=="cost_revenue"?computeDeliverableClientPrice(d)/quantity:null;
      const occupied=before!=null;
      const apply_amount=!!rate&&(mode==="overwrite"||!occupied);
      const before_fee=d.af_pct??item.af_pct??null;
      const apply_fee=price_type==="client_price"&&rate?.agency_fee_percent!=null&&(mode==="overwrite"||before_fee==null);
      const status:ApplyRow["status"]=!rate?"no_match":apply_amount?occupied?"update":"fill":apply_fee?before_fee==null?"fill":"update":"unchanged";
      return {item_id:item.id,index:i,price_type,creator:item.creator_name??creatorRef(item),platform:d.platform,deliverable:scope.map(l=>l.type+(requiresPeriod(l.type)&&l.period_months?` · ${periodLabel(l.period_months)}`:"")).join(" + "),quantity,before,after:rate?.amount??null,currency:rate?.currency??null,status,rate_id:rate?.id,components:complete?components:undefined,apply_amount,before_fee,after_fee:rate?.agency_fee_percent??null,apply_fee};
    });
  }));
}

export type ImportRow = { diagnostics?:ImportDiagnostic[]; conflicts?:{ref:string;name:string}[]; row: number; status: "ready" | "warning" | "error" | "unmatched"; issues: string[]; rate?: RateInput; rates?:RateInput[]; gp_percent?:number|null; markup_percent?:number|null; profile_urls?:string[]; profile_url?:string; pending_creator?:{profile_url:string;platform:string;handle:string} };
type ImportSeen=Set<string>|Map<string,number>;
export function validateImportRow(row: number, raw: Record<string, string>, match: { ref: string; name: string } | null, currencies: string[], seen: ImportSeen,packageData?:{package_key:string;package_details:z.infer<typeof packageDetailsSchema>},columns:Record<string,string>={}): ImportRow {
  if (!match) {const field=raw["Creator ID"]?"Creator ID":raw["Profile URL"]?"Profile URL":"Profile URL 1";return { row, status: "unmatched", issues: ["unmatched"],diagnostics:[importDiagnostic(field,raw[field],"No creator matched. Check the Creator ID or provide a valid profile link.","لم تتم مطابقة مبدع. راجع معرّف المبدع أو أدخل رابط حساب صالحاً.")] };}
  const column=(name:string)=>columns[name]??name;
  const normalizedAmount=normalizeImportDecimal(column("Rate"),raw.Rate),normalizedFee=normalizeImportDecimal("Agency Fee %",raw["Agency Fee %"]);
  const amount = normalizedAmount.value;
  const fee=normalizedFee.value;
  const diagnostics:ImportDiagnostic[]=[];
  const platform=normalizeRatePlatform(raw.Platform??"");
  if(!RATE_PLATFORM_OPTIONS.some(p=>p.value===platform))diagnostics.push(importDiagnostic("Platform",raw.Platform,"Choose a supported platform from the template, or all for an All Platforms rate.","اختر منصة مدعومة من القالب، أو all لسعر يشمل جميع المنصات."));
  const rounded=[normalizedAmount.diagnostic,normalizedFee.diagnostic].filter((d):d is NonNullable<typeof d>=>!!d);
  const parsed = rateSchema.safeParse({ ...packageData,creator_ref: match.ref, creator_name: match.name, platform, deliverable: raw["Deliverable Type"], amount: amount && /^\d+(\.\d{1,4})?$/.test(amount) ? Number(amount) : NaN, currency: raw.Currency?.trim().toUpperCase(), notes: raw.Notes ?? "",price_type:raw["Rate Type"]?.trim().toLowerCase(),period_months:requiresPeriod(raw["Deliverable Type"])?Number((raw["Period (Months)"]??"").replace(/\s*months?$/i,"")):0,event_days:raw["Deliverable Type"]==="event_attendance"?Number(raw["Event Days"]?.trim()||1):undefined,agency_fee_percent:fee?(/^\d+(\.\d{1,4})?$/.test(fee)?Number(fee):NaN):null });
  if (!parsed.success) {
    for(const issue of parsed.error.issues){
      const path=String(issue.path[0]??"");
      if(path==="amount")diagnostics.push(numericImportDiagnostic(column("Rate"),raw.Rate,999999999999));
      else if(path==="agency_fee_percent")diagnostics.push(numericImportDiagnostic("Agency Fee %",raw["Agency Fee %"],100));
      else if(path==="currency")diagnostics.push(importDiagnostic(column("Currency"),raw.Currency,`Enter a three-letter active currency: ${currencies.join(", ")}.`,`أدخل رمز عملة مفعّلة من ثلاثة أحرف: ${currencies.join(", ")}.`));
      else if(path==="period_months")diagnostics.push(importDiagnostic(column("Period (Months)"),raw["Period (Months)"],"Enter a whole number of months from 1 to 120.","أدخل عدداً صحيحاً من الشهور من ١ إلى ١٢٠."));
      else if(path==="event_days")diagnostics.push(importDiagnostic("Event Days",raw["Event Days"],"Enter a whole number of days from 1 to 365, or leave blank for 1 day.","أدخل عدداً صحيحاً من الأيام من ١ إلى ٣٦٥، أو اتركه فارغاً ليوم واحد."));
      else if(path==="price_type")diagnostics.push(importDiagnostic("Rate Type",raw["Rate Type"],"Choose creator_cost or client_price in Rate Type.","اختر creator_cost أو client_price في نوع السعر."));
      else if(path==="notes")diagnostics.push(importDiagnostic("Notes",raw.Notes,"Shorten Notes to at most 5000 characters.","اختصر الملاحظات إلى ٥٠٠٠ حرف كحد أقصى."));
      else if(path==="creator_ref")diagnostics.push(importDiagnostic("Creator ID",raw["Creator ID"]||match.ref,"Use a valid Creator ID or match the creator by profile link.","استخدم معرّف مبدع صالحاً أو طابق المبدع برابط حسابه."));
      else if(path==="creator_name")diagnostics.push(importDiagnostic("Creator Name",match.name,"Shorten the creator name to at most 300 characters.","اختصر اسم المبدع إلى ٣٠٠ حرف كحد أقصى."));
      else if(issue.message==="taxonomy"){
        if(requiresPeriod(raw["Deliverable Type"])&&!validPeriod(Number((raw["Period (Months)"]??"").replace(/\s*months?$/i,""))))diagnostics.push(importDiagnostic(column("Period (Months)"),raw["Period (Months)"],"Enter a whole number of months from 1 to 120 for this monthly rate.","أدخل عدداً صحيحاً من الشهور من ١ إلى ١٢٠ لهذا السعر الشهري."));
        else diagnostics.push(importDiagnostic("Deliverable Type",raw["Deliverable Type"],`This deliverable is not supported for Platform “${raw.Platform||"blank"}”. Choose a matching platform and deliverable from the template.`,`نوع المحتوى غير مدعوم للمنصة «${raw.Platform||"فارغة"}». اختر منصة ونوع محتوى متوافقين من القالب.`));
      } else {
        const fields:Record<string,string>={deliverable:"Deliverable Type",platform:"Platform",package_key:"Package Code",package_details:"Package Name"};
        const field=fields[path]??"Package Code";
        diagnostics.push(importDiagnostic(field,raw[field],raw[field]?"This value is not valid for the selected platform or package. Choose a supported value from the template.":"This field is required. Enter a value from the template.",raw[field]?"هذه القيمة غير صالحة للمنصة أو الباقة المختارة. اختر قيمة مدعومة من القالب.":"هذا الحقل مطلوب. أدخل قيمة من القالب."));
      }
    }
  }
  if(parsed.success&&!currencies.includes(parsed.data.currency))diagnostics.push(importDiagnostic(column("Currency"),raw.Currency,`This currency is not active. Choose: ${currencies.join(", ")}.`,`هذه العملة غير مفعّلة. اختر: ${currencies.join(", ")}.`));
  if(diagnostics.length||!parsed.success)return {row,status:"error",issues:["invalid"],diagnostics:uniqueImportDiagnostics([...diagnostics,...rounded])};
  const key = rateKey(match.ref, parsed.data.platform, parsed.data.deliverable,parsed.data.price_type,parsed.data.package_key);
  if (seen.has(key)) {const first=seen instanceof Map?seen.get(key):undefined;return { row, status: "error", issues: ["duplicate"],diagnostics:[importDiagnostic(column("Rate"),raw.Rate,`Duplicate price for the same creator, platform, deliverable, rate type and package${first?` (already in row ${first})`:""}. Keep one price or use a different package code.`,`سعر مكرر لنفس المبدع والمنصة ونوع المحتوى ونوع السعر والباقة${first?` (موجود في الصف ${first})`:""}. احتفظ بسعر واحد أو استخدم رمز باقة مختلفاً.`)] };}
  if(seen instanceof Map)seen.set(key,row);else seen.add(key);
  const warning = raw["Creator Name"] && raw["Creator Name"].trim() !== match.name.trim();
  return { row, status: warning||rounded.length ? "warning" : "ready", issues: [...(warning?["name_warning"]:[]),...(rounded.length?["rounded"]:[])],diagnostics:rounded, rate: parsed.data };
}

export function pricingPercentages(cost:number|null,price:number|null) {
  return {gp_percent:cost!=null&&price!=null&&price!==0?(price-cost)/price*100:null,markup_percent:cost!=null&&price!=null&&cost!==0?(price-cost)/cost*100:null};
}
export function validateWorkbookRow(row:number,raw:Record<string,string>,match:{ref:string;name:string}|null,currencies:string[],seen:ImportSeen):ImportRow {
  if("Rate" in raw||"Rate Type" in raw)return validateImportRow(row,raw,match,currencies,seen);
  if(!match)return validateImportRow(row,raw,match,currencies,seen);
  const rowSeen=seen instanceof Map?new Map(seen):new Set(seen);
  const packageFile="Package Code" in raw||"Package Name" in raw||"Package Client Price" in raw;
  let packageData:{package_key:string;package_details:z.infer<typeof packageDetailsSchema>}|undefined;
  if(packageFile){
    try{const p=parsePackageRow(raw);packageData={package_key:p.key,package_details:p.details};}
    catch{return {row,status:"error",issues:["invalidPackage"],diagnostics:packageImportDiagnostics(raw)};}
    raw={...raw,Platform:"all","Deliverable Type":"package","Creator Cost":raw["Package Creator Cost"],"Client Selling Price":raw["Package Client Price"]};
    if(!raw["Creator Cost"]?.trim()&&!raw["Client Selling Price"]?.trim())return {row,status:"error",issues:["invalidPackage"],diagnostics:[importDiagnostic("Package Creator Cost / Package Client Price","","Enter at least one package price; zero is allowed.","أدخل سعر باقة واحداً على الأقل؛ الصفر مسموح.")]};
  }
  const cost=raw["Creator Cost"]?.trim(),price=raw["Client Selling Price"]?.trim();
  const entries:ImportRow[]=[];
  if(cost)entries.push(validateImportRow(row,{...raw,Rate:cost,Currency:raw["Creator Currency"],"Rate Type":"creator_cost"},match,currencies,rowSeen,packageData,{Rate:packageFile?"Package Creator Cost":"Creator Cost",Currency:"Creator Currency"}));
  if(price)entries.push(validateImportRow(row,{...raw,Rate:price,Currency:raw["Client Currency"],"Rate Type":"client_price"},match,currencies,rowSeen,packageData,{Rate:packageFile?"Package Client Price":"Client Selling Price",Currency:"Client Currency"}));
  for(const [prefix,type] of [["Usage Rights","usage_right"],["Boosting","boosting"],["Event Attendance","event_attendance"]]){
    const monthly=requiresPeriod(type)?"Monthly ":"";
    for(const [suffix,priceType,currency] of [["Creator Cost","creator_cost",raw["Creator Currency"]],["Client Price","client_price",raw["Client Currency"]]]){
      const amount=raw[`${prefix} ${monthly}${suffix}`]?.trim();if(!amount)continue;
      entries.push(validateImportRow(row,{...raw,"Deliverable Type":type,Rate:amount,Currency:currency,"Rate Type":priceType,"Period (Months)":raw[`${prefix} Period (Months)`]},match,currencies,rowSeen,packageData,{Rate:`${prefix} ${monthly}${suffix}`,Currency:priceType==="creator_cost"?"Creator Currency":"Client Currency","Period (Months)":`${prefix} Period (Months)`}));
    }
  }
  if(!entries.length)return {row,status:"error",issues:["invalid"],diagnostics:[importDiagnostic("Creator Cost / Client Selling Price","","No prices were entered. Enter at least one content or extra-service price.","لم تُدخل أسعار. أدخل سعر محتوى أو خدمة إضافية واحداً على الأقل.")]};
  const invalid=entries.filter(r=>r.status==="error"||r.status==="unmatched");if(invalid.length)return {row,status:"error",issues:[...new Set(invalid.flatMap(r=>r.issues))],diagnostics:uniqueImportDiagnostics(entries.flatMap(r=>r.diagnostics??[]))};
  for(const entry of entries){const r=entry.rate!,key=rateKey(r.creator_ref,r.platform,r.deliverable,r.price_type,r.package_key);if(seen instanceof Map)seen.set(key,row);else seen.add(key);}
  const rates=entries.map(e=>e.rate!);const c=rates.find(r=>r.price_type==="creator_cost"),p=rates.find(r=>r.price_type==="client_price"&&r.deliverable===c?.deliverable);
  const metrics=c&&p&&c.currency===p.currency?pricingPercentages(c.amount,p.amount):pricingPercentages(null,null);
  return {row,status:entries.some(e=>e.status==="warning")?"warning":"ready",issues:[...new Set(entries.flatMap(e=>e.issues))],diagnostics:uniqueImportDiagnostics(entries.flatMap(e=>e.diagnostics??[])),rate:rates[0],rates,...metrics};
}

export const pricingRuleSchema=z.object({mode:z.enum(["none","cost_gp_pct","cost_markup_pct"]),percent:z.number().finite().min(0).max(10000),agencyFee:z.number().finite().min(0).max(100).nullable(),overwrite:z.boolean()}).refine(r=>r.mode!=="cost_gp_pct"||r.percent<100).refine(r=>r.mode!=="none"||r.agencyFee!=null);
export type PricingRule=z.infer<typeof pricingRuleSchema>;
export function previewPricingRule(lines:RateLine[],raw:PricingRule) {
  const rule=pricingRuleSchema.parse(raw);const result:{rate:RateInput;before:number|null;before_fee:number|null;gp_percent:number|null;markup_percent:number|null}[]=[];
  const clientRates=new Map(lines.filter(l=>l.price_type==="client_price").map(l=>[rateKey(l.creator_ref,l.platform,l.deliverable,"client_price",l.package_key),l]));
  const candidates=rule.mode==="none"?lines.filter(l=>l.price_type==="client_price"):lines.filter(l=>l.price_type==="creator_cost");
  for(const line of candidates){
    const existing=clientRates.get(rateKey(line.creator_ref,line.platform,line.deliverable,"client_price",line.package_key));
    if(existing&&!rule.overwrite&&(rule.mode!=="none"||existing.agency_fee_percent!=null))continue;
    const amount=rule.mode==="none"?line.amount:computeCommercials({mode:rule.mode,cost:line.amount,gpPct:rule.percent}).revenue;
    const rate:RateInput={event_days:line.event_days,package_key:line.package_key,package_details:line.package_details,creator_ref:line.creator_ref,creator_name:line.creator_name,platform:line.platform,deliverable:line.deliverable,price_type:"client_price",amount,currency:line.currency,notes:existing?.notes??line.notes,period_months:line.period_months,agency_fee_percent:rule.agencyFee??existing?.agency_fee_percent??line.agency_fee_percent};
    const cost=rule.mode==="none"?lines.find(c=>c.price_type==="creator_cost"&&c.creator_ref===line.creator_ref&&c.platform===line.platform&&c.deliverable===line.deliverable&&(c.package_key??"")===(line.package_key??"")&&c.currency===line.currency)?.amount??null:line.amount;
    result.push({rate,before:existing?.amount??null,before_fee:existing?.agency_fee_percent??null,...pricingPercentages(cost,amount)});
  }
  return result;
}
