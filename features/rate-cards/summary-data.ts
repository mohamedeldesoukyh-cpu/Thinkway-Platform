import type {SupabaseClient} from "@supabase/supabase-js";
import {resolveUnifiedCreatorsByRefs} from "@/lib/creators/unified-browse";
import {summarizeRateCard,type SummaryLine} from "./summary";
export async function loadRateCardSummary(db:SupabaseClient,versionId:string){
 const lines:SummaryLine[]=[];
 for(let from=0;;from+=1000){
  const result=await db.from("rate_card_lines").select("creator_ref,platform,package_details").eq("version_id",versionId).order("id").range(from,from+999);
  if(result.error)throw result.error;
  lines.push(...(result.data??[]) as SummaryLine[]);
  if((result.data?.length??0)<1000)break;
 }
 const refs=[...new Set(lines.filter(l=>l.platform==="all"&&!l.package_details).map(l=>l.creator_ref))];
 const linked:Record<string,string[]>={};
 for(let start=0;start<refs.length;start+=20){
  const part=refs.slice(start,start+20),resolved=await resolveUnifiedCreatorsByRefs(db,{unifiedIds:part});
  for(const ref of part){
   const creator=resolved.byUnifiedId.get(ref)??(ref.startsWith("dis:")?resolved.byDiscoveryId.get(ref.slice(4)):undefined);
   if(creator)linked[ref]=creator.platforms.map(p=>p.platform);
  }
 }
 return summarizeRateCard(lines,linked);
}
