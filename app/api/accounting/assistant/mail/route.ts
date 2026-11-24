import { randomUUID } from "node:crypto";
import { z } from "zod";
import { accountingContext,loadAccountingSetup } from "@/features/accounting/setup-server";
import { financeInboxRequest,financeMailKey,loadFinanceEmail,verifyFinanceInbox } from "@/features/finance-assistant/mail-server";
import { financeEmailHtml,financeEmailText,isFinanceRequester,mailSchema,reportRecipient,signMailApproval,verifyMailApproval } from "@/features/finance-assistant/mail-policy";
import { financeReportPdf } from "@/features/finance-assistant/report-pdf";
import { runFinanceAssistant } from "@/features/finance-assistant/assistant";
import { executeFinanceReport } from "@/features/finance-assistant/report-tools";
import { FinanceAiProvider } from "@/features/finance-assistant/provider";
import { assertCsrfRequest } from "@/lib/security/csrf";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=120;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
async function access() {
  const ctx=await accountingContext();
  if(!ctx.user.email||!isFinanceRequester(ctx.user.email)) throw new Error("Mailbox access is restricted to the approved finance team.");
  return ctx;
}
const threadSchema=z.object({id:z.string().uuid(),subject:z.string(),from:z.string(),received_at:z.string().nullable().optional()});
export async function GET(request:Request) {
  try {await access();} catch {return json({error:"Sign in with an approved finance account and TW Accounting access."},403);}
  try {
    await verifyFinanceInbox();
    const params=new URL(request.url).searchParams;
    const threadId=params.get("threadId");
    if(threadId){
      if(!z.string().uuid().safeParse(threadId).success)return json({error:"Invalid thread."},400);
      const result=z.object({data:z.array(mailSchema),has_more:z.boolean()}).parse(await financeInboxRequest(`/threads/${threadId}/emails?limit=100`));
      return json({messages:result.data.map(mail=>({...mail,eligible:(()=>{try{reportRecipient(mail);return true;}catch{return false;}})()})),hasMore:result.has_more});
    }
    const result=z.object({data:z.array(threadSchema),has_more:z.boolean()}).parse(await financeInboxRequest("/threads?folder=inbox&limit=25"));
    return json({connected:true,threads:result.data,hasMore:result.has_more});
  }catch(error){return json({error:error instanceof Error?error.message:"Unable to load inbox."},502);}
}
const inputSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("prepare"),threadId:z.string().uuid(),emailId:z.string().uuid(),companyId:z.string().uuid(),yearId:z.string().uuid().nullable()}).strict(),
  z.object({action:z.enum(["send","preview-pdf"]),approval:z.string().max(4_000_000)}).strict(),
]);
export async function POST(request:Request) {
  if(!assertCsrfRequest(request).ok)return json({error:"Invalid request origin."},403);
  let ctx;try{ctx=await access();}catch{return json({error:"Sign in with an approved finance account and TW Accounting access."},403);}
  if(!consumeRateLimit({category:"ai",identity:`finance-mail:${ctx.user.id}`}).allowed)return json({error:"Please wait before trying again."},429);
  let input;try{input=inputSchema.parse(await request.json());}catch{return json({error:"Invalid email request."},400);}
  try{
    await verifyFinanceInbox();
    if(input.action!=="prepare"){
      const approved=verifyMailApproval(input.approval,financeMailKey(),ctx.user.id);
      if(input.action==="preview-pdf"){
        const attachment=approved.attachments?.[0];if(!attachment)return json({error:"No PDF in this reply."},400);
        return new Response(new Uint8Array(Buffer.from(attachment.content,"base64")),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="Amgad-accounting-report.pdf"',"Cache-Control":"private, no-store"}});
      }
      // Sending is enabled separately after development verification and release approval.
      if(process.env.FINANCE_MAIL_SEND_ENABLED!=="true")return json({error:"Email sending is disabled in this environment. Review the prepared reply below."},409);
      const mail=await loadFinanceEmail(approved.threadId,approved.emailId);
      if(reportRecipient(mail)!==approved.recipient)throw new Error("The reply recipient changed. Prepare the reply again.");
      const sent=z.object({id:z.string()}).parse(await financeInboxRequest(`/threads/${approved.threadId}/emails/${approved.emailId}/reply`,{
        method:"POST",headers:{"Idempotency-Key":`amgad-review-${approved.nonce}`},
        body:JSON.stringify({text:approved.text,html:financeEmailHtml(approved.text),attachments:approved.attachments??[],cc:[],bcc:[],reply_all:false,headers:{"Auto-Submitted":"auto-replied"}}),
      }));
      return json({sent:true,id:sent.id});
    }
    const mail=await loadFinanceEmail(input.threadId,input.emailId);
    const recipient=reportRecipient(mail);
    const text=mail.text?.trim();
    if(!text||text.length>4000)return json({error:"This message needs manual review: send a plain-text request of at most 4,000 characters."},422);
    const key=process.env.FINANCE_AI_API_KEY?.trim()||process.env.OPENAI_API_KEY?.trim();
    if(!key)throw new Error("Amgad's AI connection is not configured.");
    const setup=await loadAccountingSetup(input.companyId);
    const year=setup.years.find(value=>value.id===input.yearId);
    if(input.yearId&&!year)return json({error:"Invalid company fiscal year."},400);
    const reply=await runFinanceAssistant({companyId:input.companyId,yearId:input.yearId,message:text,history:[]},{
      provider:new FinanceAiProvider(key,process.env.FINANCE_AI_MODEL?.trim()||"gpt-4.1"),
      context:JSON.stringify({company:setup.company?.name,baseCurrency:setup.company?.base_currency,yearFrom:year?.start_date,yearTo:year?.end_date,attachmentsProcessed:false}),
      execute:plan=>executeFinanceReport(ctx.db,setup,input.yearId,plan),
    });
    const body=financeEmailText(reply)+(mail.attachments?.length ? "\n\nAttachments were not read or processed. / لم تتم قراءة أو معالجة المرفقات." : "");
    const report=reply.sources.find(source=>source.tables?.length);
    const attachments=report?[{filename:"Amgad-accounting-report.pdf" as const,content:(await financeReportPdf(report,reply.retrievedAt)).toString("base64"),content_type:"application/pdf" as const}]:[];
    const approval=signMailApproval({userId:ctx.user.id,threadId:input.threadId,emailId:input.emailId,recipient,text:body,attachments,expires:Date.now()+10*60*1000,nonce:randomUUID()},financeMailKey());
    return json({recipient,text:body,approval,hasPdf:attachments.length>0,sendEnabled:process.env.FINANCE_MAIL_SEND_ENABLED==="true"});
  }catch(error){return json({error:error instanceof Error?error.message:"Unable to process email."},502);}
}
