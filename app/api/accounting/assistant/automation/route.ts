import { z } from "zod";
import { accountingContext } from "@/features/accounting/setup-server";
import { enqueueFinanceEmail,runFinanceMailWorker } from "@/features/finance-assistant/mail-worker";
import { financeAttachmentSchema } from "@/features/finance-assistant/mail-policy";
import { assertCsrfRequest } from "@/lib/security/csrf";
import { consumeRateLimit } from "@/lib/security/rate-limit";
export const runtime="nodejs";
export const maxDuration=120;
export const dynamic="force-dynamic";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
async function admin(){const ctx=await accountingContext();if(!ctx.access.admin)throw new Error("Administrator required");return ctx;}
export async function GET(request:Request){
  let ctx;try{ctx=await admin();}catch{return json({error:"Verified administrator required"},403);}
  const jobId=new URL(request.url).searchParams.get("pdf");
  if(jobId!==null){
    if(!z.string().uuid().safeParse(jobId).success)return json({error:"Invalid report request"},400);
    // Use the authenticated client so queue RLS and current administrator access
    // apply to downloads, just as they do to the visible request history.
    const result=await ctx.db.from("tw_finance_mail_jobs").select("attachments").eq("id",jobId).maybeSingle();
    if(result.error)return json({error:"Report download unavailable"},503);
    const attachments=z.array(financeAttachmentSchema).max(1).safeParse(result.data?.attachments);
    if(!attachments.success||!attachments.data.length)return json({error:"This request has no prepared PDF"},404);
    const bytes=Buffer.from(attachments.data[0].content,"base64");
    if(bytes.length>2_000_000||bytes.subarray(0,5).toString()!=="%PDF-")return json({error:"Stored report is invalid"},503);
    return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="Amgad-accounting-report.pdf"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  const [config,jobs]=await Promise.all([ctx.db.from("tw_finance_mail_config").select("company_id,year_id,enabled,updated_at").maybeSingle(),ctx.db.from("tw_finance_mail_jobs").select("id,sender,status,created_at,response_text,error_code,outbound_id,pdf_filename:attachments->0->>filename").order("created_at",{ascending:false}).limit(20)]);
  if(config.error||jobs.error)return json({error:"Email automation database is not configured."},503);
  return json({config:config.data,jobs:jobs.data,webhookConfigured:!!process.env.FINANCE_MAIL_WEBHOOK_SECRET?.trim(),autoSendEnabled:process.env.VERCEL_ENV==="production"&&process.env.FINANCE_MAIL_AUTO_SEND_ENABLED==="true"});
}
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("configure"),companyId:z.string().uuid(),yearId:z.string().uuid(),enabled:z.boolean()}).strict(),
  z.object({action:z.literal("enqueue"),threadId:z.string().uuid(),emailId:z.string().uuid()}).strict(),
  z.object({action:z.literal("process")}).strict(),
]);
export async function POST(request:Request){
  if(!assertCsrfRequest(request).ok)return json({error:"Invalid origin"},403);
  let ctx;try{ctx=await admin();}catch{return json({error:"Verified administrator required"},403);}
  if(!consumeRateLimit({category:"ai",identity:`finance-automation:${ctx.user.id}`}).allowed)return json({error:"Please wait before processing another automation action."},429);
  let input;try{input=schema.parse(await request.json());}catch{return json({error:"Invalid request"},400);}
  try{
    if(input.action==="configure"){
      const result=await ctx.db.rpc("tw_finance_mail_configure",{p_company:input.companyId,p_year:input.yearId,p_enabled:input.enabled});
      if(result.error)return json({error:"Could not save delegation. Verify MFA and the selected company/year."},403);
      return json({saved:true});
    }
    if(input.action==="enqueue")return json(await enqueueFinanceEmail(input.threadId,input.emailId));
    return json(await runFinanceMailWorker());
  }catch{return json({error:"Automation action failed. Check the connection and retry."},503);}
}
