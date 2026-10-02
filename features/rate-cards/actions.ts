"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { browseUnifiedCreators, resolveUnifiedCreatorsByRefs } from "@/lib/creators/unified-browse";
import { headerSchema, rateSchema, previewApplication, previewPricingRule, pricingRuleSchema, type PricingRule, type RateInput, type RateLine, type RateVersion, type MatchItem, type RateSource, type RateTarget } from "./model";
import { buildRateTemplate } from "./workbook";
import { parseUpload } from "./import-service";
import { updateQuotationItemCommercials } from "@/lib/services/quotations/quotation-commercial-service";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import type { Database, CommercialInputMode } from "@/types/database";
import { buildAppliedCommercials } from "./application";
import {probeCommercialLinkByQuotationItem} from "@/lib/services/commercial/probe-commercial-link";
import {Campaign} from "@/lib/finance/campaign-finance-lock";
import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { addCreatorByProfileUrl } from "@/lib/discovery/add-creator-by-profile-url";
import { optionalEnrichment } from "@/lib/creators/optional-enrichment";
import {randomUUID} from "node:crypto";
import {RATE_UPLOAD_BUCKET,RATE_UPLOAD_MAX_BYTES,validRateUploadPath} from "./upload-limits";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import { parseProfileInput } from "@/lib/social/parse-profile-url";
import { refreshCreatorMetricsBatchByUnifiedIds } from "@/lib/services/creators/creator-enrichment-service";
import { AVATAR_MAX_BYTES, normalizeRateAvatar, readRateAvatarLink } from "./avatar";

async function actor(permission: string) {
  const db = await createSupabaseServerClient();
  const auth = await requirePermission(db, `rate_cards.${permission}`);
  if ("error" in auth) throw new Error("permission");
  // New tables are isolated here until generated database types are refreshed.
  return { db: db as SupabaseClient, typed: db, userId: auth.userId };
}
function checked<T>(r: { data: T; error: { message: string } | null }): T { if (r.error) throw new Error(r.error.message); return r.data; }
function refresh() { revalidatePath("/rate-cards"); }
function dbLine(rate: RateInput) { const { creator_ref, ...rest } = rate; const [kind,id] = creator_ref.split(":"); return { ...rest, period_months:rate.period_months??0, influencer_id: kind === "inf" ? id : null, profile_id: kind === "dis" ? id : null }; }
async function canonicalRate(db: SupabaseClient, raw: unknown): Promise<RateInput> {
  const rate = rateSchema.parse(raw);
  const refs = await resolveUnifiedCreatorsByRefs(db, { unifiedIds: [rate.creator_ref] });
  const creator = refs.byUnifiedId.get(rate.creator_ref) ?? (rate.creator_ref.startsWith("dis:") ? refs.byDiscoveryId.get(rate.creator_ref.slice(4)) : undefined);
  if (!creator) throw new Error("unmatched");
  const currency = checked(await db.from("md_currencies").select("code").eq("code", rate.currency).eq("is_active", true).maybeSingle());
  if (!currency) throw new Error("currency");
  return { ...rate, creator_ref: creator.unified_id, creator_name: creator.display_name };
}
export async function rateCardOptions() {
  const { db } = await actor("read");
  const [clients,brands,currencies,permissions] = await Promise.all([
    db.from("clients").select("id,name").order("name").limit(1000),
    db.from("brands").select("id,name,client_id").order("name").limit(1000),
    db.from("md_currencies").select("code").eq("is_active",true).order("code"),
    Promise.all(["create","edit","upload","delete","activate","apply"].map(async p => [p, !("error" in await requirePermission(db, `rate_cards.${p}`))] as const)),
  ]);
  return { clients: checked(clients) as {id:string;name:string}[], brands: checked(brands) as {id:string;name:string;client_id:string}[], currencies: (checked(currencies) ?? []).map(c => String(c.code)), permissions: Object.fromEntries(permissions) };
}
export async function listRateCards(filters: { search?: string; client?: string; brand?: string; creator?: string; status?: string; version?: string; platform?: string; currency?: string; page?: number; sort?: string; ascending?: boolean } = {}) {
  const { db } = await actor("read");
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  let q = filters.creator || filters.platform
    ? db.rpc("filter_rate_card_versions",{p_creator:filters.creator||null,p_platform:filters.platform||null},{count:"exact"}).select("*")
    : db.from("rate_card_register").select("*", { count: "exact" });
  for (const [key,value] of [["client_id",filters.client],["brand_id",filters.brand],["status",filters.status],["version",filters.version]] as const) if(value) q=q.eq(key,value);
  if(filters.search) q=q.ilike("name",`%${filters.search.replace(/[%_]/g, "").slice(0,100)}%`);
  if(filters.currency) q=q.contains("currencies",[filters.currency]);
  const sort=["name","version","created_at","updated_at","creator_count","client_name"].includes(filters.sort ?? "") ? filters.sort! : "updated_at";
  const result=await q.order(sort,{ascending:filters.ascending ?? false}).order("id").range((page-1)*25,page*25-1);
  return { rows: checked(result) as RateVersion[], total: result.count ?? 0 };
}
export async function getRateVersion(id: string, page=1, search="", platform="", currency="") {
  const {db}=await actor("read"); z.uuid().parse(id);
  const version=checked(await db.from("rate_card_register").select("*").eq("id",id).single()) as RateVersion;
  let q=db.from("rate_card_service_rows").select("*",{count:"exact"}).eq("version_id",id);
  if(search) q=q.ilike("creator_name",`%${search.replace(/[%_]/g,"").slice(0,100)}%`);
  if(platform) q=q.eq("platform",platform); if(currency) q=q.contains("currencies",[currency]);
  const result=await q.order("creator_name").order("creator_ref").order("platform").order("deliverable").range((Math.max(1,page)-1)*25,Math.max(1,page)*25-1);
  const lines=(checked(result) as {rates:RateLine[]}[]).flatMap(row=>row.rates);
  if(lines.length){
    const current=await resolveUnifiedCreatorsByRefs(db,{unifiedIds:[...new Set(lines.map(l=>l.creator_ref))]});
    for(const line of lines){const creator=current.byUnifiedId.get(line.creator_ref)??(line.creator_ref.startsWith("dis:")?current.byDiscoveryId.get(line.creator_ref.slice(4)):undefined);if(creator)line.creator_name=creator.display_name;}
  }
  const avatars=lines.length?checked(await db.from("rate_card_creator_avatars").select("creator_ref,avatar_data").eq("card_id",version.card_id).in("creator_ref",[...new Set(lines.map(l=>l.creator_ref))])):[];
  return {version,lines,total:result.count??0,avatars:Object.fromEntries((avatars??[]).map(a=>[a.creator_ref,a.avatar_data as string]))};
}
export async function saveRateAvatar(versionId:string,creatorRef:string,form:FormData) {
  const {db}=await actor("edit");
  const version=checked(await db.from("rate_card_versions").select("card_id").eq("id",z.uuid().parse(versionId)).single());
  if(!version)throw new Error("invalid");
  checked(await db.from("rate_card_lines").select("id").eq("version_id",versionId).eq("creator_ref",creatorRef).limit(1).single());
  if(form.get("reset")==="true") {
    checked(await db.from("rate_card_creator_avatars").delete().eq("card_id",version.card_id).eq("creator_ref",creatorRef));
  } else {
    const file=form.get("file"),url=String(form.get("url")??"").trim();
    if(file instanceof File && file.size>AVATAR_MAX_BYTES)throw new Error("avatarInvalid");
    const bytes=file instanceof File&&file.size?Buffer.from(await file.arrayBuffer()):await readRateAvatarLink(z.string().url().max(4096).parse(url));
    const avatar_data=await normalizeRateAvatar(bytes);
    checked(await db.from("rate_card_creator_avatars").upsert({card_id:version.card_id,creator_ref:creatorRef,avatar_data,updated_at:new Date().toISOString()},{onConflict:"card_id,creator_ref"}));
  }
  refresh();
}
export async function saveRateVersion(input: unknown, id?: string, copyId?: string, expected?: string) {
  const {db}=await actor(id?"edit":"create"); const header=headerSchema.parse(input);
  const result=checked(await db.rpc("save_rate_card",{p_header:header,p_version_id:id??null,p_copy_id:copyId??null,p_expected:expected??null})); refresh(); return String(result);
}
export async function mutateRateVersion(id:string, action:"activate"|"deactivate"|"delete"|"delete_card", expected:string) {
  const {db}=await actor(action.startsWith("delete")?"delete":"activate");
  checked(await db.rpc("mutate_rate_card_version",{p_id:z.uuid().parse(id),p_action:action,p_expected:expected})); refresh();
}
export async function saveRateLine(versionId:string, input:unknown, id?:string) {
  const {db}=await actor("edit"); const rate=await canonicalRate(db,input);
  const q=id ? db.from("rate_card_lines").update(dbLine(rate)).eq("id",z.uuid().parse(id)).eq("version_id",z.uuid().parse(versionId)) : db.from("rate_card_lines").insert({...dbLine(rate),version_id:z.uuid().parse(versionId)});
  checked(await q.select("id").single()); refresh();
}
export async function removeRateLines(versionId:string, ids:string[]) {
  const {db}=await actor("edit"); z.array(z.uuid()).min(1).max(50).parse(ids);
  checked(await db.from("rate_card_lines").delete().eq("version_id",z.uuid().parse(versionId)).in("id",ids)); refresh();
}
export async function searchRateCreators(search:string, page=1, source:"all"|"discovery"="all") {
  const {db}=await actor("read");
  if(search.trim().length<2) return [];
  const result=await browseUnifiedCreators(db,{search:search.slice(0,100),page,pageSize:20,source:source==="discovery"?"public_discovery":"all"});
  return result.creators.map(c=>({id:c.unified_id,label:c.display_name}));
}

export async function downloadRateTemplate() {
  const {currencies}=await rateCardOptions();
  return Buffer.from(await buildRateTemplate(currencies)).toString("base64");
}
export async function previewRateImport(form:FormData) { const {db}=await actor("upload"); return parseUpload(db,form); }
export async function prepareRateUpload(file:{name:string;size:number}) {
  const {db,userId}=await actor("upload");
  if(!file.name.toLowerCase().endsWith(".xlsx")||!Number.isInteger(file.size)||file.size<=0||file.size>RATE_UPLOAD_MAX_BYTES)throw new Error("file");
  const path=`${userId}/${Date.now()}-${randomUUID()}.xlsx`;
  const signed=checked(await db.storage.from(RATE_UPLOAD_BUCKET).createSignedUploadUrl(path));
  if(!signed)throw new Error("file");
  return {path,url:signed.signedUrl};
}
export async function discardRateUpload(path:string) {
  const {db,userId}=await actor("upload");
  if(!validRateUploadPath(path,userId))throw new Error("file");
  await db.storage.from(RATE_UPLOAD_BUCKET).remove([path]);
}
export async function commitRateImport(form:FormData, versionId:string, mode:"new"|"update", versionName:string, expected:string) {
  z.enum(["new","update"]).parse(mode);
  const {db}=await actor("upload"); const rows=await parseUpload(db,form);
  if(rows.some(r=>r.status==="error"||r.status==="unmatched")) throw new Error("invalid");
  const current=checked(await db.from("rate_card_register").select("*").eq("id",z.uuid().parse(versionId)).single()) as RateVersion;
  const header=headerSchema.parse({...current,version:versionName,status:"inactive"});
  if(current.updated_at!==expected)throw new Error("stale");
  // Identity resolution is repeated on the server after staged creator creation.
  if(rows.some(r=>r.pending_creator))throw new Error("unmatched");
  const result=checked(await db.rpc("save_rate_card",{p_header:mode==="new"?header:null,p_version_id:mode==="update"?versionId:null,p_copy_id:mode==="new"?versionId:null,p_lines:rows.flatMap(r=>(r.rates??[r.rate!]).map(dbLine)),p_expected:expected,p_operation:"upload"}));
  const uploadPath=String(form.get("uploadPath")??"");
  if(uploadPath)await db.storage.from(RATE_UPLOAD_BUCKET).remove([uploadPath]);
  refresh(); return String(result);
}

async function pricingContext(db:SupabaseClient,versionId:string,rule:PricingRule) {
  const version=checked(await db.from("rate_card_register").select("*").eq("id",z.uuid().parse(versionId)).single()) as RateVersion;
  const lines:RateLine[]=[];
  for(let from=0;;from+=1000){const part=checked(await db.from("rate_card_lines").select("*").eq("version_id",versionId).order("id").range(from,from+999)) as RateLine[];lines.push(...part);if(part.length<1000)break;}
  const rows=previewPricingRule(lines,pricingRuleSchema.parse(rule));
  return {version,rows,fingerprint:createHash("sha256").update(JSON.stringify({version,lines,rule})).digest("hex")};
}
export async function previewRatePricing(versionId:string,rule:PricingRule) {const {db}=await actor("edit");const p=await pricingContext(db,versionId,rule);return {rows:p.rows,fingerprint:p.fingerprint};}
export async function applyRatePricing(versionId:string,rule:PricingRule,fingerprint:string) {
  const {db}=await actor("edit");const p=await pricingContext(db,versionId,rule);if(p.fingerprint!==fingerprint)throw new Error("stale");
  checked(await db.rpc("save_rate_card",{p_header:null,p_version_id:versionId,p_expected:p.version.updated_at,p_lines:p.rows.map(r=>dbLine(r.rate)),p_operation:"pricing"}));refresh();
}

export async function clientRateCardSetting(clientId:string, enabled?:boolean) {
  const {db}=await actor(enabled===undefined?"read":"edit"); z.uuid().parse(clientId);
  if(enabled!==undefined) {
    checked(await db.from("clients").update({rate_cards_enabled:enabled}).eq("id",clientId).select("id").single()); revalidatePath("/clients");
  }
  return Boolean(checked(await db.from("clients").select("rate_cards_enabled").eq("id",clientId).single())?.rate_cards_enabled);
}

type QuoteItem=MatchItem & {cost_currency:string;commercial_input_mode:CommercialInputMode;revenue:number;gp_pct:number;gp_value:number;af_pct:number;rate_card_sources?:Record<string,RateSource>};
async function quotationContext(db:SupabaseClient,id:string) {
  const auth=await requirePermission(db,QUOTATION_PERMISSIONS.write);
  if("error" in auth && "error" in await requirePermission(db,QUOTATION_PERMISSIONS.admin)) throw new Error("permission");
  const q=checked(await db.from("quotations").select("id,client_id,brand_id,status,issue_date").eq("id",z.uuid().parse(id)).single()); if(!q) throw new Error("invalid"); return q;
}
export async function availableQuotationRates(quotationId:string) {
  const {db}=await actor("apply"); const q=await quotationContext(db,quotationId);
  if(!q.client_id) return [];
  const rows=checked(await db.from("rate_card_register").select("*").eq("client_id",q.client_id).order("name").order("version")) as RateVersion[];
  return rows.filter(v=>!v.brand_id||v.brand_id===q.brand_id);
}
async function application(db:SupabaseClient,quotationId:string,versionId:string,mode:"missing"|"overwrite",only?:{item_id:string;index:number},target:RateTarget="creator_cost") {
  z.enum(["missing","overwrite"]).parse(mode);
  z.enum(["creator_cost","client_price","both"]).parse(target);
  const q=await quotationContext(db,quotationId);
  const version=checked(await db.from("rate_card_register").select("*").eq("id",z.uuid().parse(versionId)).single()) as RateVersion;
  if(version.client_id!==q.client_id||(version.brand_id&&version.brand_id!==q.brand_id)) throw new Error("scope");
  const items:QuoteItem[]=[];
  for(let from=0;;from+=1000){const part=checked(await db.from("quotation_items").select("*").eq("quotation_id",quotationId).order("id").range(from,from+999)) as QuoteItem[];items.push(...part);if(part.length<1000)break;}
  const rates:RateLine[]=[];
  for(let from=0;;from+=1000) { const chunk=checked(await db.from("rate_card_lines").select("*").eq("version_id",versionId).order("id").range(from,from+999)) as RateLine[]; rates.push(...chunk); if(chunk.length<1000) break; }
  const rows=previewApplication(items,rates,mode,only,target);
  const fx=new Map<string,number>();
  for(const row of rows.filter(r=>r.status==="update"||r.status==="fill")) {
    const item=items.find(i=>i.id===row.item_id)!; const target=item.deliverables[row.index].cost_currency||item.cost_currency;
    for(const c of [row.currency!,target]) if(!fx.has(c)) fx.set(c,await resolveRateToEgp(db,c,q.issue_date));
    row.after=Math.round(row.after!*fx.get(row.currency!)!/fx.get(target)!*10000)/10000; row.currency=target;
  }
  const linked=[];
  for(const itemId of new Set(rows.filter(r=>r.status==="update"||r.status==="fill").map(r=>r.item_id))){
    const probe=await probeCommercialLinkByQuotationItem(db as SupabaseClient<Database>,itemId);
    if(probe.linked){const lock=probe.campaignHeaderId?await Campaign.isFinanceLocked(db as SupabaseClient<Database>,probe.campaignHeaderId):null;linked.push({item_id:itemId,campaign:probe.campaignDocumentNumber,concurrencyToken:probe.concurrencyToken,locked:!!lock?.locked});}
  }
  const fingerprint=createHash("sha256").update(JSON.stringify({q,version,items,rates,rows,mode,only,target,linked})).digest("hex");
  return {q,version,items,rates,rows,fingerprint,linked};
}
export async function previewQuotationRates(quotationId:string,versionId:string,mode:"missing"|"overwrite",only?:{item_id:string;index:number},target:RateTarget="creator_cost") {
  const {db}=await actor("apply"); const p=await application(db,quotationId,versionId,mode,only,target);
  return {rows:p.rows,fingerprint:p.fingerprint,linked:p.linked};
}
export async function applyQuotationRates(quotationId:string,versionId:string,mode:"missing"|"overwrite",fingerprint:string,only?:{item_id:string;index:number},target:RateTarget="creator_cost",confirmLinked=false) {
  const {db,typed,userId}=await actor("apply"); const p=await application(db,quotationId,versionId,mode,only,target);
  if(p.fingerprint!==fingerprint) throw new Error("stale");
  if(p.linked.some(l=>l.locked))throw new Error("financeLocked");
  if(p.linked.length&&!confirmLinked)throw new Error("linkedConfirmation");
  const results:{item_id:string;ok:boolean;message?:string}[]=[];
  const fx=new Map<string,number>();
  for(const item of p.items)for(const currency of [item.cost_currency,...item.deliverables.map(d=>d.cost_currency||item.cost_currency)]){
    if(!fx.has(currency))fx.set(currency,await resolveRateToEgp(db,currency,p.q.issue_date));
  }
  for(const item of p.items) {
    const changes=p.rows.filter(r=>r.item_id===item.id&&(r.status==="fill"||r.status==="update")); if(!changes.length) continue;
    const transaction=buildAppliedCommercials(item,changes,fx);
    const sources={...item.rate_card_sources};
    for(const r of changes){
      const rate=p.rates.find(x=>x.id===r.rate_id)!;
      sources[String(r.index)+":"+r.price_type]={card_id:p.version.card_id,version_id:versionId,name:p.version.name,version:p.version.version,amount:r.after??rate.amount,currency:rate.currency,components:r.components,applied_at:new Date().toISOString(),applied_by:userId,applied_amount:r.apply_amount?r.after!:r.before??0,applied_currency:r.currency!,price_type:r.price_type,application_mode:mode,agency_fee_percent:r.apply_fee?r.after_fee:null};
    }
    const result=await updateQuotationItemCommercials(typed as SupabaseClient<Database>,userId,{item_id:item.id,quotation_id:quotationId,mode:"cost_revenue",cost_currency:item.cost_currency,gp_pct:item.gp_pct,gp_value:item.gp_value,...transaction},{confirmCommercialSync:confirmLinked,expectedConcurrencyToken:p.linked.find(l=>l.item_id===item.id)?.concurrencyToken??undefined,idempotencyKey:`rate-card:${fingerprint}:${item.id}`,rateCardApplication:{sources,expectedDeliverables:item.deliverables,expectedCost:item.cost??null,expectedRevenue:item.revenue,expectedCurrency:item.cost_currency}}).catch(()=>({ok:false as const,message:"error"}));
    results.push({item_id:item.id,ok:result.ok,...(!result.ok?{message:result.message}:{})});
    if(!result.ok) break; // Report partial completion; never silently skip failed lines.
  }
  revalidatePath(`/discovery/quotations/${quotationId}`); return results;
}
export async function quotationRateSources(quotationId:string) {
  const {db}=await actor("read"); if("error" in await requirePermission(db,QUOTATION_PERMISSIONS.read))throw new Error("permission");
  return checked(await db.from("quotation_items").select("id,rate_card_sources").eq("quotation_id",quotationId)) as {id:string;rate_card_sources:Record<string,RateSource & {manual_override?:boolean}>}[];
}

export async function rateCardAudit(versionId:string,page=1) {
  const {db}=await actor("read");
  const version=checked(await db.from("rate_card_versions").select("card_id").eq("id",z.uuid().parse(versionId)).single());
  if(!version)throw new Error("invalid");
  const result=await db.from("audit_logs").select("id,action,actor_id,created_at,old_data,new_data,metadata",{count:"exact"}).eq("metadata->>card_id",version.card_id).order("created_at",{ascending:false}).order("id").range((Math.max(1,page)-1)*25,Math.max(1,page)*25-1);
  return {rows:checked(result) as {id:string;action:string;actor_id:string;created_at:string;old_data:unknown;new_data:unknown;metadata:Record<string,unknown>}[],total:result.count??0};
}

export async function ensureImportCreator(profileUrl:string, permission:"upload"|"edit"="upload"){
  z.enum(["upload","edit"]).parse(permission);
  const {db,typed,userId}=await actor(permission);
  const parsed=parseProfileInput(profileUrl);
  if(!parsed)throw new Error("invalid");
  if("error" in await requirePermission(db,CREATOR_ENRICHMENT_PERMISSION))throw new Error("permission");
  const found=checked(await db.rpc("match_rate_card_handle",{p_platform:parsed.platform,p_handle:parsed.normalized_username})) as {creator_ref:string;creator_name:string}[];
  const matches=[...new Map(found.map(c=>[c.creator_ref,c])).values()];
  if(matches.length>1)throw new Error("unmatched");
  if(matches.length===1){
    const match=matches[0];
    const refreshResult=await optionalEnrichment(()=>refreshCreatorMetricsBatchByUnifiedIds(typed,[match.creator_ref],{force:true,trigger:"manual",scope:"all",requestedBy:userId,feature:"add_creator"}));
    const refreshed=refreshResult?.results[0];
    return {id:match.creator_ref,name:match.creator_name,created:false,queued:refreshed?.queued??false,platform:parsed.platform,pollId:refreshed?.influencerId??undefined};
  }
  let result=await addCreatorByProfileUrl(typed,{profileUrl,actorId:userId,skipIfExists:false,returnExisting:true,skipPreviewEnrichment:true,tolerateEnrichmentFailure:true});
  // A concurrent import may win the unique-account insert; resolve the winner.
  if(!result.ok)result=await addCreatorByProfileUrl(typed,{profileUrl,actorId:userId,skipIfExists:false,returnExisting:true,skipPreviewEnrichment:true,tolerateEnrichmentFailure:true});
  if(!result.ok||!result.creator)throw new Error("enrichment");
  return {id:result.creator.unified_id,name:result.creator.display_name,created:result.created,queued:result.enrichmentQueued,platform:parsed.platform,pollId:result.creator.influencer_id??undefined};
}
