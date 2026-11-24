import {z} from "zod";
import {cents,decimal} from "@/features/accounting/journal-model";
import type {AccountingSetup} from "@/features/accounting/setup-types";
import type {FinanceEvidence,FinancePlan} from "./contracts";
import type {FinanceReportClient} from "./report-tools";
export async function accountingControls(db:FinanceReportClient,setup:AccountingSetup,yearId:string|null,plan:Extract<FinancePlan,{action:"accounting_controls"}>&{from:string;to:string}):Promise<FinanceEvidence>{
 const company=setup.company!;
 if(!yearId)throw Error("Select a fiscal year for accounting controls.");
 const response=await db.rpc("tw_finance_accounting_controls",{p_company:company.id,p_year:yearId,p_from:plan.from,p_to:plan.to,p_section:plan.section});
 if(response.error)throw Error("Accounting controls unavailable.");
 const title={budget:"Budget versus actual",close:"Accounting close status",bank_reconciliation:"Bank reconciliation exceptions"}[plan.section];
 const result=z.object({columns:z.array(z.string()),rows:z.array(z.array(z.string())).max(10000)}).parse(response.data);
 if(plan.section==="budget"){
  result.columns.push("Actual less budget");
  result.rows=result.rows.map(r=>[...r,r[4]==="Not set"?"—":decimal(cents(r[5])-cents(r[4]))]);
 }
 return {title,href:`/accounting?company=${company.id}#amgad`,reportPlan:plan,tables:[{heading:title,orientation:"portrait",...result}],
  scope:`${company.name} · ${plan.from} to ${plan.to} · ${plan.section==="budget"?"Company base currency. Recorded budgets versus posted ledger actuals for complete fiscal periods; missing budgets are not zero. Variance is actual less budget, not a favorable/unfavorable judgment.":plan.section==="close"?"Current period locks and journal posting status. This does not certify a completed financial close.":"Unmatched imported bank-statement rows only, in each bank's currency. No matches or accounting changes were made. This does not include ledger-only exceptions."}`,
  facts:{company:company.name,from:plan.from,to:plan.to,section:plan.section,count:result.rows.length,currency:plan.section==="budget"?company.base_currency:undefined,currentOnly:plan.section!=="budget"}};
}
