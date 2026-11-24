import { z } from "zod";
import { accountingContext,loadAccountingSetup } from "@/features/accounting/setup-server";
import { financePlanSchema } from "@/features/finance-assistant/contracts";
import { executeFinanceReport } from "@/features/finance-assistant/report-tools";
import { assertCsrfRequest } from "@/lib/security/csrf";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:Request){try{
 const {db,user}=await accountingContext();const company=z.string().uuid().parse(new URL(request.url).searchParams.get("company"));
 const result=await db.from("tw_finance_saved_reports").select("id,name,year_id,created_at").eq("company_id",company).eq("owner_id",user.id).order("created_at",{ascending:false}).limit(50);
 if(result.error)throw Error("Saved reports unavailable.");return json(result.data);
}catch{return json({error:"Could not load your saved reports."},400);}}
export async function POST(request:Request){
 if(!assertCsrfRequest(request).ok)return json({error:"Invalid origin"},403);
 try{
  const {db,user}=await accountingContext();
  const input=z.discriminatedUnion("action",[
   z.object({action:z.literal("save"),companyId:z.string().uuid(),yearId:z.string().uuid().nullable(),plan:financePlanSchema}).strict(),
   z.object({action:z.literal("run"),id:z.string().uuid(),companyId:z.string().uuid()}).strict(),
  ]).parse(await request.json());
  const setup=await loadAccountingSetup(input.companyId);
  if(input.action==="save"){
   if(input.plan.action!=="custom_ledger")throw Error("Only custom ledger definitions can be saved here.");
   if(input.yearId&&!setup.years.some(y=>y.id===input.yearId))throw Error("Invalid year.");
   const result=await db.from("tw_finance_saved_reports").insert({owner_id:user.id,company_id:input.companyId,year_id:input.yearId,name:input.plan.title,plan:input.plan}).select("id").single();
   if(result.error)throw Error("Could not save the report.");return json(result.data);
  }
  const saved=await db.from("tw_finance_saved_reports").select("plan,year_id").eq("id",input.id).eq("company_id",input.companyId).eq("owner_id",user.id).single();
  if(saved.error)throw Error("Saved report unavailable.");
  const plan=financePlanSchema.parse(saved.data.plan);if(plan.action!=="custom_ledger")throw Error("Unsupported saved report.");
  const evidence=await executeFinanceReport(db,setup,saved.data.year_id,plan);
  return json({content:"Saved custom report regenerated from current Accounting records.",sources:[evidence],retrievedAt:new Date().toISOString()});
 }catch(e){return json({error:e instanceof Error?e.message:"Report request failed."},400);}
}
