import {rateImportProfiles} from "./import-profiles";
import {normalizeRatePlatform} from "./platforms";
import {createHash} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {z} from "zod";
import {resolveUnifiedCreatorsByRefs} from "@/lib/creators/unified-browse";
import {buildCanonicalProfileUrl,isSocialPlatform} from "@/lib/social/platforms";
import {parseProfileInput} from "@/lib/social/parse-profile-url";
import {readRateWorkbook} from "./workbook";
import {RATE_UPLOAD_BUCKET,RATE_UPLOAD_MAX_BYTES,validRateUploadPath} from "./upload-limits";
import {rateImportIdentity} from "./import-identity";
import {validateWorkbookRow,type ImportRow} from "./model";
function checked<T>(r:{data:T;error:{message:string}|null}):T{if(r.error)throw new Error(r.error.message);return r.data;}
export async function parseUpload(db:SupabaseClient, form:FormData, progress?:(processed:number,total:number)=>void):Promise<ImportRow[]> {
  let file=form.get("file");
  const path=String(form.get("uploadPath")??"");
  if(path){
    const auth=await db.auth.getUser();const userId=auth.data.user?.id;
    if(!userId||!validRateUploadPath(path,userId))throw new Error("file");
    const uploaded=checked(await db.storage.from(RATE_UPLOAD_BUCKET).download(path));
    if(!uploaded||uploaded.size>RATE_UPLOAD_MAX_BYTES)throw new Error("file");
    file=new File([uploaded],"rates.xlsx");
  }
  if(!(file instanceof File)||file.size>RATE_UPLOAD_MAX_BYTES||!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("file");
  const uploaded=await readRateWorkbook(await file.arrayBuffer());
  progress?.(0,uploaded.length);
  const currencies=(checked(await db.from("md_currencies").select("code").eq("is_active",true)) ?? []).map(c=>String(c.code));
  const rows:ImportRow[]=[]; const seen=new Set<string>(); const cache=new Map<string,{ref:string;name:string}|null>();
  const ambiguous=new Map<string,{ref:string;name:string}[]>();
  const pending=new Map<string,{profile_url:string;platform:string;handle:string}>();
  const profileRows=uploaded.map(({raw})=>{try{return rateImportProfiles(raw);}catch{return null;}});
  const identities=uploaded.map(({raw},i)=>rateImportIdentity({...raw,"Profile URL":(profileRows[i]?.find(p=>p.platform===normalizeRatePlatform(raw.Platform??""))??profileRows[i]?.[0])?.profile_url||raw["Profile URL"]||""}));
  const related=profileRows.map(profiles=>(profiles??[]).map(p=>rateImportIdentity({"Profile URL":p.profile_url})));
  const explicitIds=uploaded.map(({raw})=>rateImportIdentity({"Creator ID":raw["Creator ID"]??""}));
  const unique=[...new Map([...identities,...related.flat(),...explicitIds.filter(i=>i.id)].map(i=>[i.key,i])).values()];
  for(let from=0;from<unique.length;from+=100){
    const batch=unique.slice(from,from+100),ids=batch.filter(i=>i.id);
    const refs=await resolveUnifiedCreatorsByRefs(db,{unifiedIds:ids.filter(i=>/^(inf|dis):[0-9a-f-]{36}$/.test(i.id)).map(i=>i.id),influencerIds:ids.filter(i=>z.uuid().safeParse(i.id).success).map(i=>i.id),discoveredProfileIds:ids.filter(i=>z.uuid().safeParse(i.id).success).map(i=>i.id)});
    for(const i of ids){const raw=i.id.split(":")[1];const a=refs.byInfluencerId.get(i.id),b=refs.byDiscoveryId.get(i.id);const c=refs.byUnifiedId.get(i.id)||(i.id.startsWith("dis:")?refs.byDiscoveryId.get(raw):undefined)||(a&&!b?a:b&&!a?b:undefined);cache.set(i.key,c?{ref:c.unified_id,name:c.display_name}:null);}
    const candidates=batch.filter(i=>!i.id&&i.handle);const matches=candidates.length?checked(await db.rpc("match_rate_card_handles",{p_candidates:candidates})) as {match_key:string;creator_ref:string;creator_name:string}[]:[];
    for(const i of candidates){const found=matches.filter(m=>m.match_key===i.key);if(found.length===1)cache.set(i.key,{ref:found[0].creator_ref,name:found[0].creator_name});else if(found.length>1){cache.set(i.key,null);ambiguous.set(i.key,found.map(m=>({ref:m.creator_ref,name:m.creator_name})));}else{
      if(!isSocialPlatform(i.platform)){cache.set(i.key,null);continue;}
      const parsed=parseProfileInput(buildCanonicalProfileUrl(i.platform,i.handle))!;
      const hash=createHash("sha256").update(i.key).digest("hex");const temporaryId=hash.slice(0,8)+"-"+hash.slice(8,12)+"-4"+hash.slice(13,16)+"-8"+hash.slice(17,20)+"-"+hash.slice(20,32);
      cache.set(i.key,{ref:"inf:"+temporaryId,name:i.handle});pending.set(i.key,{profile_url:parsed.profile_url,platform:i.platform,handle:i.handle});
    }}
    progress?.(Math.min(from+100,unique.length),unique.length);
  }
  for(const [rowIndex,{row:n,raw,unsupported}] of uploaded.entries()) {
    if(unsupported){rows.push({row:n,status:"error",issues:["invalid"]});continue;}
    let identity=identities[rowIndex];
    if(!profileRows[rowIndex]){rows.push({row:n,status:"error",issues:["invalid"]});continue;}
    const candidates=[identity,...related[rowIndex],...(explicitIds[rowIndex].id?[explicitIds[rowIndex]]:[])];
    const ambiguousOwners=candidates.flatMap(i=>ambiguous.get(i.key)??[]);
    if(ambiguousOwners.length){rows.push({row:n,status:"error",issues:["profileConflict"],conflicts:[...new Map(ambiguousOwners.map(c=>[c.ref,c])).values()]});continue;}
    const existing=candidates.filter(i=>cache.get(i.key)&&!pending.has(i.key));
    if(new Set(existing.map(i=>cache.get(i.key)!.ref)).size>1){rows.push({row:n,status:"error",issues:["profileConflict"],conflicts:[...new Map(existing.map(i=>{const c=cache.get(i.key)!;return [c.ref,c];})).values()]});continue;}
    if(existing.length)identity=existing[0];
    const {key}=identity;
    const validated=validateWorkbookRow(n,{...raw,Platform:normalizeRatePlatform(raw.Platform??"")||identities[rowIndex].platform||""},cache.get(key)??null,currencies,seen);
    validated.profile_urls=profileRows[rowIndex]!.map(p=>p.profile_url);
    if(identity.profile_url)validated.profile_url=identity.profile_url;
    if(pending.has(key)&&validated.status!=="error"&&validated.status!=="unmatched") {validated.pending_creator=pending.get(key);validated.status="warning";validated.issues.push("newCreatorImport");}
    rows.push(validated);
  }
  if(!rows.length) throw new Error("file"); return rows;
}
