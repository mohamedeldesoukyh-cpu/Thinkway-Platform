import {z} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {requirePermission} from "@/lib/auth/permissions-server";
import {buildRateExcel} from "@/features/rate-cards/excel-export";
import type {RateLine,RateVersion} from "@/features/rate-cards/model";
import {errorLabel,textFor} from "@/features/rate-cards/labels";
export const dynamic="force-dynamic";
export const maxDuration=300;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const q=new URL(request.url).searchParams,lang=q.get("lang")==="ar"?"ar":"en";
 try{const {id}=await params;if(!z.uuid().safeParse(id).success)return new Response(null,{status:400});const audience=q.get("audience");if(audience!=="client"&&audience!=="internal")return new Response(null,{status:400});const client=await createSupabaseServerClient();if("error" in await requirePermission(client,"rate_cards.read"))return new Response(null,{status:403});const db=client as SupabaseClient;
  const v=await db.from("rate_card_register").select("*").eq("id",id).single();if(v.error)throw new Error("invalid");
  const search=audience==="internal"?(q.get("search")??"").slice(0,100):"",platform=audience==="internal"?q.get("platform")??"":"",currency=audience==="internal"?q.get("currency")??"":"";
  let allowed:Set<string>|null=null;if(search||platform||currency){allowed=new Set();for(let from=0;;from+=1000){let query=db.from("rate_card_creator_rows").select("creator_ref,platform").eq("version_id",id);if(search)query=query.ilike("creator_name",`%${search.replace(/[%_]/g,"")}%`);if(platform)query=query.eq("platform",platform);if(currency)query=query.contains("currencies",[currency]);const r=await query.order("creator_ref").order("platform").range(from,from+999);if(r.error)throw r.error;for(const row of r.data??[])allowed.add(JSON.stringify([row.creator_ref,row.platform]));if((r.data?.length??0)<1000)break;}}
  const fields="id,version_id,creator_ref,creator_name,platform,deliverable,amount,currency,price_type,agency_fee_percent,period_months,event_days,package_key,package_details,tu_a_percent,tu_b_percent,itu_percent";
  const lines:RateLine[]=[];for(let from=0;;from+=1000){let query=db.from("rate_card_lines").select(audience==="internal"?fields+",notes":fields).eq("version_id",id);if(audience==="client")query=query.eq("price_type","client_price");const r=await query.order("creator_name").order("creator_ref").order("platform").order("id").range(from,from+999);if(r.error)throw r.error;for(const line of (r.data??[]) as unknown as RateLine[])if(!allowed||allowed.has(JSON.stringify([line.creator_ref,line.platform])))lines.push(line);if((r.data?.length??0)<1000)break;}
  // Keep cost-only offers discoverable without fetching their private amounts or notes.
  if(audience==="client"){for(let from=0;;from+=1000){const r=await db.from("rate_card_lines").select("id,version_id,creator_ref,creator_name,platform,deliverable,price_type,package_key,package_details,tu_a_percent,tu_b_percent,itu_percent").eq("version_id",id).eq("price_type","creator_cost").order("id").range(from,from+999);if(r.error)throw r.error;lines.push(...(r.data??[]) as unknown as RateLine[]);if((r.data?.length??0)<1000)break;}}
  lines.sort((a,b)=>a.creator_name.localeCompare(b.creator_name)||a.creator_ref.localeCompare(b.creator_ref)||a.platform.localeCompare(b.platform));
  const scope=audience==="client"?"Entire version · client prices only":search||platform||currency?`All matching pages · Search: ${search||"All"} · Platform: ${platform||"All"} · Currency: ${currency||"All"}`:"Entire version · all pricing details (internal)";
  const bytes=await buildRateExcel(v.data as RateVersion,lines,audience,scope,lang);return new Response(bytes,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="rate-card-${audience}.xlsx"`,"Cache-Control":"private, no-store"}});
 }catch(e){return Response.json({error:textFor(lang,errorLabel(e))},{status:422});}
}
