import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { assertCsrfRequest } from "@/lib/security/csrf";
import { parseUpload } from "@/features/rate-cards/import-service";
import { errorLabel } from "@/features/rate-cards/labels";

export const maxDuration=300;
export async function POST(request:Request){
  if(!assertCsrfRequest(request).ok)return new Response(null,{status:403});
  const db=await createSupabaseServerClient();
  if("error" in await requirePermission(db,"rate_cards.upload"))return new Response(null,{status:403});
  if(Number(request.headers.get("content-length"))>11*1024*1024)return new Response(null,{status:413});
  const form=await request.formData();
  const encoder=new TextEncoder();
  const stream=new ReadableStream({async start(controller){
    const send=(data:unknown)=>controller.enqueue(encoder.encode(JSON.stringify(data)+"\n"));
    try{
      send({stage:"validating"});
      const rows=await parseUpload(db,form,(processed,total)=>{if(processed%25===0||processed===total)send({stage:"matching",processed,total});});
      send({stage:"completed",rows});
    }catch(error){send({stage:"error",error:errorLabel(error)});}
    finally{controller.close();}
  }});
  return new Response(stream,{headers:{"Content-Type":"application/x-ndjson","Cache-Control":"no-store","X-Accel-Buffering":"no"}});
}
