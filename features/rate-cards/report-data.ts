import type {PackageDetails} from "./packages";
import type {SupabaseClient} from "@supabase/supabase-js";
import {buildCreatorGroup} from "@/features/discovery/shortlists/export/shortlist-document";
import {embedShortlistAvatarDataUri} from "@/features/discovery/shortlists/export/shortlist-export-avatars";
import {resolveUnifiedCreatorsByRefs} from "@/lib/creators/unified-browse";
import type {RateVersion} from "./model";
import type {Database} from "@/types/database";
import type {ClientRate,RateCardReport} from "./report";
import {loadCreatorListClientLogo} from "@/features/discovery/shortlists/export/creator-list-client-logo";
import {compactReportAvatar} from "./report-avatar";

export const RATE_PREVIEW_SIZE = 12;

export async function loadRateCardReport(db:SupabaseClient,id:string,previewPage?:number,includePrices=true):Promise<RateCardReport & {preview?:{page:number;pages:number;total:number}}>{
  const versionResult=await db.from("rate_card_register").select("*").eq("id",id).single();
  if(versionResult.error)throw new Error("invalid");const v=versionResult.data as RateVersion;
  // Explicit allowlist: never read internal cost amounts or private pricing notes for reports.
  const platforms=new Map<string,Set<string>>();const scopes=new Map<string,PackageDetails[]>();const identities=new Set<string>();const prices=new Map<string,ClientRate[]>();
  for(let from=0;;from+=1000){
    const r=await db.from("rate_card_lines").select("creator_ref,platform,price_type,package_details").eq("version_id",id).order("id").range(from,from+999);if(r.error)throw r.error;
    for(const row of r.data??[]){identities.add(row.creator_ref);if(!row.package_details&&row.price_type==="client_price")platforms.set(row.creator_ref,new Set([...(platforms.get(row.creator_ref)??[]),row.platform]));if(row.package_details)scopes.set(row.creator_ref,[...(scopes.get(row.creator_ref)??[]),row.package_details as PackageDetails]);}if((r.data?.length??0)<1000)break;
  }
  const allRefs=[...identities];
  const pages=Math.max(1,Math.ceil(allRefs.length/RATE_PREVIEW_SIZE));
  const page=Math.min(pages,Math.max(1,Math.floor(previewPage||1)));
  const refs=previewPage===undefined?allRefs:allRefs.slice((page-1)*RATE_PREVIEW_SIZE,page*RATE_PREVIEW_SIZE);
  for(let from=0;includePrices&&refs.length;from+=1000){
    let query=db.from("rate_card_lines").select("creator_ref,platform,deliverable,amount,currency,agency_fee_percent,period_months,package_key,package_details,event_days,tu_a_percent,tu_b_percent,itu_percent").eq("version_id",id).eq("price_type","client_price");
    if(previewPage!==undefined)query=query.in("creator_ref",refs);
    const r=await query.order("id").range(from,from+999);if(r.error)throw r.error;
    for(const {creator_ref,...rate} of r.data??[])prices.set(creator_ref,[...(prices.get(creator_ref)??[]),rate as ClientRate]);if((r.data?.length??0)<1000)break;
  }
  const creators:RateCardReport["creators"]=[];
  const profilePhotos=new Map<string,{src:string|null;url:string|null}[]>();
  for(let start=0;start<refs.length;start+=20){
    const part=refs.slice(start,start+20),resolved=await resolveUnifiedCreatorsByRefs(db,{unifiedIds:part});
    const avatarResult=await db.from("rate_card_creator_avatars").select("creator_ref,avatar_data").eq("card_id",v.card_id).in("creator_ref",part);
    if(avatarResult.error)throw avatarResult.error;
    const avatars=new Map((avatarResult.data??[]).map(a=>[a.creator_ref,a.avatar_data as string]));
    for(const ref of part){
      const creator=resolved.byUnifiedId.get(ref)??(ref.startsWith("dis:")?resolved.byDiscoveryId.get(ref.slice(4)):undefined);if(!creator)throw new Error("unmatched");
      const group=buildCreatorGroup({item_id:ref,item_status:"draft",notes:null,match_score:null,unified_id:ref,influencer_id:creator.influencer_id,profile_id:creator.discovered_profile_id,platform_account_ids:creator.platforms.map(p=>p.id),creator,quotation_refs:[],collapse_group_id:null,collapse_label:null},creators.length+1);
      if(!group)throw new Error("unmatched");
      if(avatars.has(ref)){group.avatarUrl=avatars.get(ref)!;group.avatarProxyUrl=null;}
      const existing=creators.find(c=>c.group.creatorKey===creator.unified_id);
      if(existing){existing.platformScopes?.push(...(platforms.get(ref)??[]));existing.rates.push(...(prices.get(ref)??[]));existing.packageScopes?.push(...(scopes.get(ref)??[]));continue;}
      group.creatorKey=creator.unified_id;
      profilePhotos.set(group.creatorKey,creator.platforms.map(p=>({src:p.profile_picture_url??null,url:p.profile_url??null})));
      creators.push({group,platformScopes:includePrices?undefined:[...(platforms.get(ref)??[])],packageScopes:scopes.get(ref)??[],rates:prices.get(ref)??[],performance:creator.platforms.map(p=>({platform:p.platform,followers:p.follower_count,engagement:p.engagement_rate,views:p.avg_views??null,likes:p.avg_likes??null,comments:p.avg_comments??null,audienceCountry:p.audience_country,profileUrl:p.profile_url}))});
    }
  }
  // Bound image concurrency; reuse the existing protected image fetching pipeline.
  for(let from=0;from<creators.length;from+=5)await Promise.all(creators.slice(from,from+5).map(async c=>{
    const candidates=[{src:c.group.avatarUrl,url:c.group.avatarProfileUrl},...(profilePhotos.get(c.group.creatorKey)??[])];
    const seen=new Set<string>();let avatar:string|null=null;
    for(const candidate of candidates){
      const key=JSON.stringify(candidate);if(seen.has(key))continue;seen.add(key);
      avatar=await embedShortlistAvatarDataUri(candidate.src,candidate.url,db as SupabaseClient<Database>);
      if(avatar){avatar=await compactReportAvatar(avatar);if(avatar)break;}
    }
    c.group.avatarUrl=avatar;c.group.avatarProxyUrl=null;
  }));
  return {clientLogo:await loadCreatorListClientLogo(db,v.client_id),name:v.name,version:v.version,client:v.client_name,brand:v.brand_name,effective:v.effective_date,expiry:v.expiry_date,creators,...(previewPage===undefined?{}:{preview:{page,pages,total:allRefs.length}})};
}
