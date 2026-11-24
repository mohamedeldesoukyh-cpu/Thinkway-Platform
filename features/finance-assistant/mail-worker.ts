import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountingSetup, Company } from "@/features/accounting/setup-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runFinanceAssistant } from "./assistant";
import { FinanceAiProvider } from "./provider";
import { executeFinanceReport, type FinanceReportClient } from "./report-tools";
import { financeEmailText,reportRecipient } from "./mail-policy";
import { financeReportPdf } from "./report-pdf";
import { loadFinanceEmail,loadFinanceSenderEvidence,financeInboxRequest,verifyFinanceInbox } from "./mail-server";
import { deliverAutomaticReply } from "./auto-reply-policy";

const jobSchema=z.object({id:z.string().uuid(),email_id:z.string().uuid(),thread_id:z.string().uuid(),sender:z.string(),company_id:z.string().uuid(),year_id:z.string().uuid(),lease_id:z.string().uuid(),attempts:z.number()});
type Job=z.infer<typeof jobSchema>;
async function rpc(db:SupabaseClient,name:string,args:Record<string,unknown>={}){const result=await db.rpc(name,args);if(result.error)throw new Error(`Queue operation failed: ${name}`);return result.data;}
export async function enqueueFinanceEmail(threadId:string,emailId:string){
  await verifyFinanceInbox();
  const mail=await loadFinanceEmail(threadId,emailId);
  let sender:string;try{sender=reportRecipient(mail);}catch{return {queued:false};}
  // Replies from automatic responders should not generate another automatic reply.
  if(/automatic reply|auto.?reply|out of office|رد تلقائي|خارج المكتب/i.test(mail.subject))return {queued:false};
  const id=await rpc(createSupabaseAdminClient(),"tw_finance_mail_enqueue",{p_email:emailId,p_thread:threadId,p_sender:sender});
  return {queued:!!id,id};
}
async function reportSetup(db:SupabaseClient,job:Job):Promise<AccountingSetup>{
  const raw=await rpc(db,"tw_finance_mail_read",{p_job:job.id,p_lease:job.lease_id,p_operation:"setup"});
  const setup=z.object({company:z.object({id:z.string(),name:z.string(),base_currency:z.string()}).passthrough(),year:z.object({id:z.string(),start_date:z.string(),end_date:z.string()}),accounts:z.array(z.object({code:z.string(),name:z.string(),name_ar:z.string(),parent_code:z.string().nullable(),account_type:z.enum(["Asset","Liability","Equity","Revenue","Expense"]),normal_balance:z.enum(["Debit","Credit"]),kind:z.enum(["Group","Posting","Control","System"]),active:z.boolean(),version:z.number()}))}).parse(raw);
  if(setup.company.id!==job.company_id||setup.year.id!==job.year_id)throw new Error("Delegated scope mismatch");
  const company=setup.company as Company;
  return {company,companies:[company],years:[setup.year],periods:[],users:[],access:{accounting:true,media:false,manage:false,admin:false},accounts:setup.accounts.map(a=>({code:a.code,name:a.name,nameAr:a.name_ar,parent:a.parent_code,type:a.account_type,normal:a.normal_balance,kind:a.kind,active:a.active,version:a.version}))};
}
function delegatedReports(db:SupabaseClient,job:Job):FinanceReportClient{
  return {rpc:async(name,args)=>{
    try{
      if(args.p_company!==job.company_id)throw new Error("Wrong company");
      const operation=name==="tw_accounting_party_lookup"?"party_lookup":name==="tw_finance_statement_snapshot"?"statement":name==="tw_accounting_open_items"?"outstanding":null;
      if(!operation)throw new Error("Unsupported report operation");
      const options=args.p_options as {reportMode?:string;display?:string}|undefined;
      const parameters=operation==="party_lookup"?{search:args.p_search}:operation==="outstanding"?{party:args.p_party,currency:args.p_currency}:{action:options?.reportMode==="profit"?"pnl":args.p_kind==="all"?"custom_ledger":"client_statement",account:args.p_account,display:options?.display,from:args.p_from,to:args.p_to,party:args.p_party,offset:args.p_offset};
      return {data:await rpc(db,"tw_finance_mail_read",{p_job:job.id,p_lease:job.lease_id,p_operation:operation,p_args:parameters}),error:null};
    }catch{return {data:null,error:"Delegated report unavailable"};}
  }};
}
export async function runFinanceMailWorker(){
  const db=createSupabaseAdminClient();
  const claimed=await rpc(db,"tw_finance_mail_claim");
  if(!claimed?.length)return {processed:0};
  const job=jobSchema.parse(claimed[0]);
  try{
    const mail=await loadFinanceEmail(job.thread_id,job.email_id);
    if(reportRecipient(mail)!==job.sender)throw new Error("Sender changed");
    const text=mail.text?.trim();
    if(!text||text.length>4000)throw new Error("Message requires manual review");
    const setup=await reportSetup(db,job);
    const apiKey=process.env.FINANCE_AI_API_KEY?.trim()||process.env.OPENAI_API_KEY?.trim();
    if(!apiKey)throw new Error("AI unavailable");
    const reply=await runFinanceAssistant({companyId:job.company_id,yearId:job.year_id,message:text,history:[]},{
      channel:"automatic_email",
      provider:new FinanceAiProvider(apiKey,process.env.FINANCE_AI_MODEL?.trim()||"gpt-4.1"),
      context:JSON.stringify({company:setup.company?.name,baseCurrency:setup.company?.base_currency,yearFrom:setup.years[0].start_date,yearTo:setup.years[0].end_date,attachmentsProcessed:false}),
      execute:plan=>executeFinanceReport(delegatedReports(db,job),setup,job.year_id,plan),
    });
    const report=reply.sources.find(source=>source.tables?.length);
    const attachments=report?[{filename:"Amgad-accounting-report.pdf",content:(await financeReportPdf(report,reply.retrievedAt)).toString("base64"),content_type:"application/pdf"}]:[];
    const response=financeEmailText(reply,{pdfAttached:attachments.length>0})+(mail.attachments?.length?"\n\nIncoming attachments were not processed. / لم تتم معالجة المرفقات الواردة.":"");
    const updated=await db.from("tw_finance_mail_jobs").update({status:"prepared",response_text:response,attachments,error_code:null,lease_id:null,lease_until:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("lease_id",job.lease_id).eq("status","processing").select("id");
    if(updated.error||!updated.data?.length)throw new Error("Job lease lost");
    return {processed:1,status:"prepared"};
  }catch{
    await db.from("tw_finance_mail_jobs").update({status:job.attempts>=3?"needs_review":"queued",error_code:"preparation_failed",lease_id:null,lease_until:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("lease_id",job.lease_id);
    return {processed:1,status:"retry_or_review"};
  }
}

export async function sendPreparedFinanceMail(){
  // Never send development-ledger reports through the real mailbox.
  if(process.env.VERCEL_ENV!=="production"||process.env.FINANCE_MAIL_AUTO_SEND_ENABLED!=="true")return {sent:0};
  const db=createSupabaseAdminClient();
  let lease:string|null=null;
  return deliverAutomaticReply({
    environment:process.env.VERCEL_ENV,enabled:process.env.FINANCE_MAIL_AUTO_SEND_ENABLED,
    claim:async()=>{const jobs=await rpc(db,"tw_finance_mail_claim_send");lease=jobs?.[0]?.lease_id??null;return jobs?.[0]??null;},
    load:async job=>{await verifyFinanceInbox();const mail=await loadFinanceEmail(job.thread_id,job.email_id);return {mail,received:await loadFinanceSenderEvidence(job.email_id)};},
    hold:async(job,reason)=>{const result=await db.from("tw_finance_mail_jobs").update({status:"needs_review",error_code:reason,lease_id:null,lease_until:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("lease_id",lease).eq("status","sending");if(result.error)throw Error("Could not hold reply for review");},
    send:async(job,payload,key)=>z.object({id:z.string()}).parse(await financeInboxRequest(`/threads/${job.thread_id}/emails/${job.email_id}/reply`,{method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify(payload)})).id,
    finish:async(job,receipt)=>{const done=await db.from("tw_finance_mail_jobs").update({status:"sent",outbound_id:receipt,lease_until:null,lease_id:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("lease_id",lease).eq("status","sending").select("id");if(done.error||!done.data?.length)throw Error("Send receipt persistence failed");},
    pending:async job=>{await db.from("tw_finance_mail_jobs").update({error_code:"send_retry_pending"}).eq("id",job.id).eq("lease_id",lease).eq("status","sending");},
  });
}
