import type { SupabaseClient } from "@supabase/supabase-js";

/** Keep diagnostics actionable without exposing raw database errors or connection strings. */
export async function probeCreatorCount(supabase: SupabaseClient): Promise<{count:number|null;reason:string}> {
  try {
    const {count,error} = await supabase.from("influencers").select("id",{count:"exact",head:true});
    if(error){
      const code=error.code;
      const reason=code==="42501" ? "Creator count query was denied by database permissions. Check the signed-in Operations role and influencers access policies."
        : code==="57014" ? "Creator count query timed out. Check database load and the influencers access-policy query."
        : code==="42P01"||code==="PGRST205" ? "The influencers table is unavailable in this database. Check deployment database alignment and migrations."
        : code==="PGRST301"||code==="PGRST303" ? "Creator count authentication expired or is invalid. Sign in again and refresh."
        : "Creator count query failed. Check database connectivity and Operations logs, then refresh.";
      return {count:null,reason};
    }
    return count==null ? {count:null,reason:"The database returned no creator count. Refresh and check the database count response."}
      : {count,reason:`${count} creators in influencers.`};
  }catch{
    return {count:null,reason:"Creator count request could not reach the database. Check connectivity and refresh."};
  }
}
