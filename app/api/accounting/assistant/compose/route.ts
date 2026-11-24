import {randomUUID} from "node:crypto";
import {z} from "zod";
import {accountingContext,loadAccountingSetup} from "@/features/accounting/setup-server";
import {financePlanSchema} from "@/features/finance-assistant/contracts";
import {executeFinanceReport} from "@/features/finance-assistant/report-tools";
import {financeReportPdf} from "@/features/finance-assistant/report-pdf";
import {financeMailKey} from "@/features/finance-assistant/mail-server";
import {FINANCE_MAILBOX,financeEmailHtml,isFinanceRequester} from "@/features/finance-assistant/mail-policy";
import {recipientsSchema,signComposedMail,verifyComposedMail} from "@/features/finance-assistant/compose-policy";
import {assertCsrfRequest} from "@/lib/security/csrf";
import {consumeRateLimit} from "@/lib/security/rate-limit";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=120;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("prepare"),companyId:z.string().uuid(),yearId:z.string().uuid().nullable(),plan:financePlanSchema,recipients:recipientsSchema,language:z.enum(["en","ar"]),purpose:z.enum(["statement","payment_followup"]),note:z.string().trim().max(2000)}).strict(),
 z.object({action:z.enum(["send","preview-pdf"]),approval:z.string().max(4_000_000)}).strict(),
]);
export async function POST(request:Request){
 if(!assertCsrfRequest(request).ok)return json({error:"Invalid origin"},403);
 let ctx;try{ctx=await accountingContext();if(!ctx.user.email||!isFinanceRequester(ctx.user.email))throw Error();}catch{return json({error:"Approved finance-team access required."},403);}
 if(!consumeRateLimit({category:"ai",identity:`finance-compose:${ctx.user.id}`}).allowed)return json({error:"Please wait before trying again."},429);
 try{
  const input=schema.parse(await request.json());
  if(input.action!=="prepare"){
   const mail=verifyComposedMail(input.approval,financeMailKey(),ctx.user.id);
   await loadAccountingSetup(mail.companyId);
   if(input.action==="preview-pdf")return new Response(new Uint8Array(Buffer.from(mail.attachments[0].content,"base64")),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="Amgad-accounting-report.pdf"',"Cache-Control":"private, no-store"}});
   if(process.env.VERCEL_ENV!=="production"||process.env.FINANCE_MAIL_SEND_ENABLED!=="true")return json({error:"Sending is disabled here. Development reports cannot be emailed to clients."},409);
   const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${financeMailKey()}`,"Content-Type":"application/json","Idempotency-Key":`amgad-compose-${mail.nonce}`},body:JSON.stringify({from:`Amgad — Thinkway Finance <${FINANCE_MAILBOX}>`,to:mail.recipients.to,cc:mail.recipients.cc,reply_to:FINANCE_MAILBOX,subject:mail.subject,text:mail.text,html:financeEmailHtml(mail.text),attachments:mail.attachments}),signal:AbortSignal.timeout(20000)});
   if(!result.ok)throw Error(`Email provider returned ${result.status}. Retry the same prepared email; do not prepare a duplicate.`);
   const receipt=z.object({id:z.string()}).parse(await result.json());return json({sent:true,id:receipt.id});
  }
  if(input.plan.action==="reply")throw Error("Select a system report.");
  if(input.purpose==="payment_followup"&&input.plan.action!=="client_outstanding")throw Error("Use a current unsettled client statement for a payment follow-up.");
  const setup=await loadAccountingSetup(input.companyId);
  if(input.yearId&&!setup.years.some(y=>y.id===input.yearId))throw Error("Invalid fiscal year.");
  const report=await executeFinanceReport(ctx.db,setup,input.yearId,input.plan);
  if(!report.tables?.length)throw Error("Resolve the client selection before preparing email.");
  const arabic=input.language==="ar",followup=input.purpose==="payment_followup";
  if(followup&&(!Number(report.facts.count)||Number(report.facts.outstanding)<=0))throw Error("There are no positive open invoices to follow up.");
  const subject=followup?(arabic?"متابعة المستحقات — Thinkway":"Payment follow-up — Thinkway"):(arabic?"كشف الحساب / التقرير المالي — Thinkway":"Account statement / financial report — Thinkway");
  const intro=followup?(arabic?"تحية طيبة،\nمرفق كشف الفواتير غير المسددة بحسب سجلاتنا الحالية. نرجو مراجعتها وإفادتنا بموعد السداد المتوقع. إذا تم السداد بالفعل، يرجى إرسال إشعار التحويل لمراجعته ومطابقته.":"Hello,\nPlease find attached the open invoices shown in our current records. Please review and confirm the expected payment date. If payment has already been made, please share the remittance advice so we can reconcile it."):(arabic?"تحية طيبة،\nمرفق التقرير المطلوب من النظام للمراجعة. يرجى إبلاغنا بأي استفسارات أو فروق.":"Hello,\nPlease find the requested system report attached for your review. Please let us know about any questions or differences.");
  const retrievedAt=new Date().toISOString();
  const text=[intro,input.note,report.title,report.scope,`Prepared: ${retrievedAt}`,"Amgad — AI Finance Assistant\nThinkway"].filter(Boolean).join("\n\n");
  const attachment={filename:"Amgad-accounting-report.pdf" as const,content:(await financeReportPdf(report,retrievedAt)).toString("base64"),content_type:"application/pdf" as const};
  const approval=signComposedMail({userId:ctx.user.id,companyId:input.companyId,recipients:input.recipients,subject,text,attachments:[attachment],expires:Date.now()+10*60*1000,nonce:randomUUID()},financeMailKey());
  return json({approval,subject,text,recipients:input.recipients,sendEnabled:process.env.VERCEL_ENV==="production"&&process.env.FINANCE_MAIL_SEND_ENABLED==="true"});
 }catch(e){return json({error:e instanceof Error?e.message:"Email preparation failed."},400);}
}
