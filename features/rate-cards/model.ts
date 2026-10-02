import { z } from "zod";
import { DELIVERABLE_TYPES_BY_PLATFORM, canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { computeDeliverableClientPrice, deliverableQuantity } from "@/lib/quotations/quotation-deliverable-commercial";
import { computeCommercials } from "@/lib/commercial/commercial-engine";

export type RateType = "creator_cost" | "client_price";
export type RateTarget = RateType | "both";

export const headerSchema = z.object({
  client_id: z.uuid(), brand_id: z.uuid().nullable(), name: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(50), status: z.enum(["active", "inactive"]),
  effective_date: z.iso.date().nullable(), expiry_date: z.iso.date().nullable(), notes: z.string().max(5000).default(""),
}).refine(v => !v.effective_date || !v.expiry_date || v.expiry_date >= v.effective_date, { message: "dates" });
export type HeaderInput = z.infer<typeof headerSchema>;
export const rateSchema = z.object({
  creator_ref: z.string().regex(/^(inf|dis):[0-9a-f-]{36}$/i), creator_name: z.string().max(300),
  platform: z.string(), deliverable: z.string(), amount: z.number().finite().min(0).max(999999999999),
  currency: z.string().regex(/^[A-Z]{3}$/), notes: z.string().max(5000).default(""),
  price_type: z.enum(["creator_cost", "client_price"]),
  agency_fee_percent: z.number().finite().min(0).max(100).nullable().default(null),
}).refine(v => DELIVERABLE_TYPES_BY_PLATFORM[v.platform]?.some(t => t.value === v.deliverable), { message: "taxonomy" });
export type RateInput = z.infer<typeof rateSchema>;
export type RateLine = RateInput & { id: string; version_id: string; creator_cost?:number|null; client_price?:number|null; creator_currency?:string|null; client_currency?:string|null; gp_percent?:number|null; markup_percent?:number|null };
export type RateVersion = HeaderInput & { id: string; card_id: string; created_at: string; updated_at: string; client_name: string; brand_name: string | null; creator_count: number; currencies: string[] };
export type RateSource = { card_id: string; version_id: string; name: string; version: string; amount: number; currency: string; applied_at: string; applied_by: string; applied_amount?: number; applied_currency?: string; manual_override?: boolean; price_type: RateType; application_mode?:"missing"|"overwrite"; agency_fee_percent?:number|null };
export type MatchItem = { id: string; influencer_id?: string | null; profile_id?: string | null; unified_id?: string | null; creator_name?: string | null; cost?: number | null; revenue?: number | null; af_pct?: number | null; deliverables: QuotationDeliverable[] };
export type RateCardWriteSnapshot={quotationItemId:string;deliverables:QuotationDeliverable[];sources:Record<string,RateSource>;expectedDeliverables:QuotationDeliverable[];expectedCost:number|null;expectedRevenue:number;expectedCurrency:string};
export type ApplyRow = { item_id: string; index: number; price_type: RateType; creator: string; platform: string; deliverable: string; quantity: number; before: number | null; after: number | null; currency: string | null; status: "update" | "fill" | "unchanged" | "no_match"; rate_id?: string; apply_amount:boolean; before_fee:number|null; after_fee:number|null; apply_fee:boolean };
export function creatorRef(item: Pick<MatchItem, "influencer_id" | "profile_id" | "unified_id">) {
  return item.influencer_id ? `inf:${item.influencer_id}` : item.profile_id ? `dis:${item.profile_id}` : item.unified_id ?? "";
}
export function rateKey(ref: string, platform: string, deliverable: string, priceType:RateType) { return JSON.stringify([ref, canonicalPlatformKey(platform), deliverable, priceType]); }
export function previewApplication(items: MatchItem[], rates: RateLine[], mode: "missing" | "overwrite", only?: { item_id: string; index: number }, target:RateTarget="creator_cost"): ApplyRow[] {
  const index = new Map<string, RateLine[]>();
  for (const r of rates) { const key = rateKey(r.creator_ref, r.platform, r.deliverable, r.price_type); index.set(key, [...(index.get(key) ?? []), r]); }
  return items.flatMap(item => item.deliverables.flatMap((d, i) => {
    if (only && (only.item_id !== item.id || only.index !== i)) return [];
    // A multi-type package is not an exact single-deliverable match.
    const types = d.type_lines?.map(t => t.type) ?? d.types ?? [d.type];
    const targets:RateType[]=target==="both"?["creator_cost","client_price"]:[target];
    return targets.map(price_type=>{
      const matches=types.length===1?index.get(rateKey(creatorRef(item),d.platform,types[0],price_type))??[]:[];
      const rate=matches.length===1?matches[0]:undefined;
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
      return {item_id:item.id,index:i,price_type,creator:item.creator_name??creatorRef(item),platform:d.platform,deliverable:types.join(" + "),quantity,before,after:rate?.amount??null,currency:rate?.currency??null,status,rate_id:rate?.id,apply_amount,before_fee,after_fee:rate?.agency_fee_percent??null,apply_fee};
    });
  }));
}

export type ImportRow = { row: number; status: "ready" | "warning" | "error" | "unmatched"; issues: string[]; rate?: RateInput; rates?:RateInput[]; gp_percent?:number|null; markup_percent?:number|null; pending_creator?:{profile_url:string;platform:string;handle:string} };
export function validateImportRow(row: number, raw: Record<string, string>, match: { ref: string; name: string } | null, currencies: string[], seen: Set<string>): ImportRow {
  if (!match) return { row, status: "unmatched", issues: ["unmatched"] };
  const amount = raw.Rate?.trim();
  const fee=raw["Agency Fee %"]?.trim();
  const parsed = rateSchema.safeParse({ creator_ref: match.ref, creator_name: match.name, platform: canonicalPlatformKey(raw.Platform), deliverable: raw["Deliverable Type"], amount: amount && /^\d+(\.\d{1,4})?$/.test(amount) ? Number(amount) : NaN, currency: raw.Currency?.trim().toUpperCase(), notes: raw.Notes ?? "",price_type:raw["Rate Type"]?.trim().toLowerCase(),agency_fee_percent:fee?(/^\d+(\.\d{1,4})?$/.test(fee)?Number(fee):NaN):null });
  if (!parsed.success) return { row, status: "error", issues: ["invalid"] };
  if (!currencies.includes(parsed.data.currency)) return { row, status: "error", issues: ["currency"] };
  const key = rateKey(match.ref, parsed.data.platform, parsed.data.deliverable,parsed.data.price_type);
  if (seen.has(key)) return { row, status: "error", issues: ["duplicate"] };
  seen.add(key);
  const warning = raw["Creator Name"] && raw["Creator Name"].trim() !== match.name.trim();
  return { row, status: warning ? "warning" : "ready", issues: warning ? ["name_warning"] : [], rate: parsed.data };
}

export function pricingPercentages(cost:number|null,price:number|null) {
  return {gp_percent:cost!=null&&price!=null&&price!==0?(price-cost)/price*100:null,markup_percent:cost!=null&&price!=null&&cost!==0?(price-cost)/cost*100:null};
}
export function validateWorkbookRow(row:number,raw:Record<string,string>,match:{ref:string;name:string}|null,currencies:string[],seen:Set<string>):ImportRow {
  if("Rate" in raw||"Rate Type" in raw)return validateImportRow(row,raw,match,currencies,seen);
  if(!match)return {row,status:"unmatched",issues:["unmatched"]};
  const cost=raw["Creator Cost"]?.trim(),price=raw["Client Selling Price"]?.trim();
  if(!cost&&!price)return {row,status:"error",issues:["invalid"]};
  const entries:ImportRow[]=[];
  if(cost)entries.push(validateImportRow(row,{...raw,Rate:cost,Currency:raw["Creator Currency"],"Rate Type":"creator_cost"},match,currencies,seen));
  if(price)entries.push(validateImportRow(row,{...raw,Rate:price,Currency:raw["Client Currency"],"Rate Type":"client_price"},match,currencies,seen));
  const invalid=entries.find(r=>r.status==="error"||r.status==="unmatched");if(invalid)return invalid;
  const rates=entries.map(e=>e.rate!);const c=rates.find(r=>r.price_type==="creator_cost"),p=rates.find(r=>r.price_type==="client_price");
  const metrics=c&&p&&c.currency===p.currency?pricingPercentages(c.amount,p.amount):pricingPercentages(null,null);
  return {row,status:entries.some(e=>e.status==="warning")?"warning":"ready",issues:[...new Set(entries.flatMap(e=>e.issues))],rate:rates[0],rates,...metrics};
}

export const pricingRuleSchema=z.object({mode:z.enum(["none","cost_gp_pct","cost_markup_pct"]),percent:z.number().finite().min(0).max(10000),agencyFee:z.number().finite().min(0).max(100).nullable(),overwrite:z.boolean()}).refine(r=>r.mode!=="cost_gp_pct"||r.percent<100).refine(r=>r.mode!=="none"||r.agencyFee!=null);
export type PricingRule=z.infer<typeof pricingRuleSchema>;
export function previewPricingRule(lines:RateLine[],raw:PricingRule) {
  const rule=pricingRuleSchema.parse(raw);const result:{rate:RateInput;before:number|null;before_fee:number|null;gp_percent:number|null;markup_percent:number|null}[]=[];
  const clientRates=new Map(lines.filter(l=>l.price_type==="client_price").map(l=>[rateKey(l.creator_ref,l.platform,l.deliverable,"client_price"),l]));
  const candidates=rule.mode==="none"?lines.filter(l=>l.price_type==="client_price"):lines.filter(l=>l.price_type==="creator_cost");
  for(const line of candidates){
    const existing=clientRates.get(rateKey(line.creator_ref,line.platform,line.deliverable,"client_price"));
    if(existing&&!rule.overwrite&&(rule.mode!=="none"||existing.agency_fee_percent!=null))continue;
    const amount=rule.mode==="none"?line.amount:computeCommercials({mode:rule.mode,cost:line.amount,gpPct:rule.percent}).revenue;
    const rate:RateInput={creator_ref:line.creator_ref,creator_name:line.creator_name,platform:line.platform,deliverable:line.deliverable,price_type:"client_price",amount,currency:line.currency,notes:existing?.notes??line.notes,agency_fee_percent:rule.agencyFee??existing?.agency_fee_percent??line.agency_fee_percent};
    const cost=rule.mode==="none"?lines.find(c=>c.price_type==="creator_cost"&&c.creator_ref===line.creator_ref&&c.platform===line.platform&&c.deliverable===line.deliverable&&c.currency===line.currency)?.amount??null:line.amount;
    result.push({rate,before:existing?.amount??null,before_fee:existing?.agency_fee_percent??null,...pricingPercentages(cost,amount)});
  }
  return result;
}
