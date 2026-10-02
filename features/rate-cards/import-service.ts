import {createHash} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {z} from "zod";
import {resolveUnifiedCreatorsByRefs} from "@/lib/creators/unified-browse";
import {buildCanonicalProfileUrl,isSocialPlatform} from "@/lib/social/platforms";
import {parseProfileInput} from "@/lib/social/parse-profile-url";
import {readRateWorkbook} from "./workbook";
import {rateImportIdentity} from "./import-identity";
import {validateWorkbookRow,type ImportRow} from "./model";
function checked<T>(r:{data:T;error:{message:string}|null}):T{if(r.error)throw new Error(r.error.message);return r.data;}
export async function parseUpload(db:SupabaseClient, form:FormData, progress?:(processed:number,total:number)=>void):Promise<ImportRow[]> {
  const file=form.get("file"); if(!(file instanceof File)||file.size>10*1024*1024||!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("file");
  const uploaded=await readRateWorkbook(await file.arrayBuffer());
  progress?.(0,uploaded.length);
  const currencies=(checked(await db.from("md_currencies").select("code").eq("is_active",true)) ?? []).map(c=>String(c.code));
  const rows:ImportRow[]=[]; const seen=new Set<string>(); const cache=new Map<string,{ref:string;name:string}|null>();
  const pending=new Map<string,{profile_url:string;platform:string;handle:string}>();
  const identities=uploaded.map(({raw})=>rateImportIdentity(raw));
  const unique=[...new Map(identities.map(i=>[i.key,i])).values()];
  for(let from=0;from<unique.length;from+=100){
    const batch=unique.slice(from,from+100),ids=batch.filter(i=>i.id);
    const refs=await resolveUnifiedCreatorsByRefs(db,{unifiedIds:ids.filter(i=>/^(inf|dis):[0-9a-f-]{36}$/.test(i.id)).map(i=>i.id),influencerIds:ids.filter(i=>z.uuid().safeParse(i.id).success).map(i=>i.id),discoveredProfileIds:ids.filter(i=>z.uuid().safeParse(i.id).success).map(i=>i.id)});
    for(const i of ids){const raw=i.id.split(":")[1];const a=refs.byInfluencerId.get(i.id),b=refs.byDiscoveryId.get(i.id);const c=refs.byUnifiedId.get(i.id)||(i.id.startsWith("dis:")?refs.byDiscoveryId.get(raw):undefined)||(a&&!b?a:b&&!a?b:undefined);cache.set(i.key,c?{ref:c.unified_id,name:c.display_name}:null);}
    const candidates=batch.filter(i=>!i.id&&i.handle);const matches=candidates.length?checked(await db.rpc("match_rate_card_handles",{p_candidates:candidates})) as {match_key:string;creator_ref:string;creator_name:string}[]:[];
    for(const i of candidates){const found=matches.filter(m=>m.match_key===i.key);if(found.length===1)cache.set(i.key,{ref:found[0].creator_ref,name:found[0].creator_name});else if(found.length>1)cache.set(i.key,null);else{
      if(!isSocialPlatform(i.platform)){cache.set(i.key,null);continue;}
      const parsed=parseProfileInput(buildCanonicalProfileUrl(i.platform,i.handle))!;
      const hash=createHash("sha256").update(i.key).digest("hex");const temporaryId=hash.slice(0,8)+"-"+hash.slice(8,12)+"-4"+hash.slice(13,16)+"-8"+hash.slice(17,20)+"-"+hash.slice(20,32);
      cache.set(i.key,{ref:"inf:"+temporaryId,name:i.handle});pending.set(i.key,{profile_url:parsed.profile_url,platform:i.platform,handle:i.handle});
    }}
    progress?.(Math.min(from+100,unique.length),unique.length);
  }
  for(const [rowIndex,{row:n,raw,unsupported}] of uploaded.entries()) {
    if(unsupported){rows.push({row:n,status:"error",issues:["invalid"]});continue;}
    const {key}=identities[rowIndex];
    const validated=validateWorkbookRow(n,raw,cache.get(key)??null,currencies,seen);
    if(pending.has(key)&&validated.status!=="error"&&validated.status!=="unmatched") {validated.pending_creator=pending.get(key);validated.status="warning";validated.issues.push("newCreatorImport");}
    rows.push(validated);
  }
  if(!rows.length) throw new Error("file"); return rows;
}
