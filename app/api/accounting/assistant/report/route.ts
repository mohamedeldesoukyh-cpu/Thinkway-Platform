import { z } from "zod";
import { accountingContext,loadAccountingSetup } from "@/features/accounting/setup-server";
import { financePlanSchema } from "@/features/finance-assistant/contracts";
import { executeFinanceReport } from "@/features/finance-assistant/report-tools";
import { financeReportPdf } from "@/features/finance-assistant/report-pdf";
import { assertCsrfRequest } from "@/lib/security/csrf";
import { consumeRateLimit } from "@/lib/security/rate-limit";
export const runtime="nodejs";
export const maxDuration=120;
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!assertCsrfRequest(request).ok)return Response.json({error:"Invalid origin"},{status:403});
 let ctx;try{ctx=await accountingContext();}catch{return Response.json({error:"Accounting access required"},{status:403});}
 if(!consumeRateLimit({category:"ai",identity:`finance-pdf:${ctx.user.id}`}).allowed)return Response.json({error:"Please wait before exporting another report."},{status:429});
 try{
  const input=z.object({companyId:z.string().uuid(),yearId:z.string().uuid().nullable(),plan:financePlanSchema}).strict().parse(await request.json());
  if(input.plan.action==="reply")throw Error("Select a report.");
  const setup=await loadAccountingSetup(input.companyId);
  if(input.yearId&&!setup.years.some(y=>y.id===input.yearId))throw Error("Invalid fiscal year.");
  const evidence=await executeFinanceReport(ctx.db,setup,input.yearId,input.plan);
  const pdf=await financeReportPdf(evidence,new Date().toISOString());
  return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="Amgad-accounting-report.pdf"',"Cache-Control":"private, no-store"}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Report export failed."},{status:400,headers:{"Cache-Control":"private, no-store"}});}
}
