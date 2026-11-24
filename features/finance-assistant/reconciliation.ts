import { z } from "zod";
import { parseBankCsv } from "@/features/accounting/bank-model";
import { cents, decimal } from "@/features/accounting/journal-model";
import type { LedgerRow } from "./ledger-details";
import type { FinanceEvidence } from "./contracts";

export const reconciliationSchema=z.object({
  companyId:z.string().uuid(),yearId:z.string().uuid().nullable(),
  account:z.string().regex(/^\d{6}$/),currency:z.string().regex(/^[A-Z]{3}$/),
  from:z.string().date(),to:z.string().date(),
  clientName:z.string().trim().min(2).max(120).optional(),
  csv:z.string().min(1).max(2_000_000),
  opening:z.string().regex(/^-?\d{1,14}(\.\d{1,2})?$/),
  closing:z.string().regex(/^-?\d{1,14}(\.\d{1,2})?$/),
  direction:z.enum(["same","opposite"]),pdf:z.boolean().default(false),
}).strict().refine(v=>v.from<=v.to,"Invalid period");
export type ReconciliationInput=z.infer<typeof reconciliationSchema>;

/** Conservative one-to-one matching: reference, date, currency and signed amount.
 * Duplicate candidates on EITHER side stay ambiguous. Nothing is posted/cleared. */
export function reconcileStatement(input:ReconciliationInput,ledger:LedgerRow[],ledgerOpening:string,ledgerClosing:string):FinanceEvidence {
  const rows=parseBankCsv(input.csv);
  if(rows.some(r=>r.date<input.from||r.date>input.to))throw Error("Statement rows fall outside the selected period.");
  if(ledger.some(r=>r.account!==input.account||r.report_currency!==input.currency))throw Error("Ledger scope mismatch.");
  const direction=input.direction==="same"?BigInt(1):-BigInt(1);
  const movement=rows.reduce((sum,r)=>sum+cents(r.amount),BigInt(0));
  if(cents(input.opening)+movement!==cents(input.closing))throw Error("Statement opening plus signed movements does not equal closing. Check missing rows, signs and balances.");
  const normalize=(value:string)=>value.trim().normalize("NFKC").toLocaleUpperCase("en-US");
  const key=(date:string,reference:string,amount:bigint)=>JSON.stringify([date,normalize(reference),amount.toString()]);
  const statementKeys=rows.map(r=>key(r.date,r.reference,cents(r.amount)*direction));
  const ledgerKeys=ledger.map(r=>key(r.date,r.reference,cents(r.debit)-cents(r.credit)));
  const used=new Set<number>();let matched=0,ambiguous=0;
  const details=rows.map((r,index)=>{
    const candidates=ledgerKeys.flatMap((k,i)=>k===statementKeys[index]?[i]:[]);
    const duplicate=statementKeys.filter(k=>k===statementKeys[index]).length>1;
    const unique=!!r.reference.trim()&&!duplicate&&candidates.length===1;
    if(unique){used.add(candidates[0]);matched++;}else if(duplicate||candidates.length>1)ambiguous++;
    return [String(index+2),r.date,r.reference,r.description,r.amount,decimal(cents(r.amount)*direction),unique?"Matched candidate":duplicate||candidates.length>1?"Ambiguous — review":"Unmatched — review",candidates.map(i=>`${ledger[i].number} / ${ledger[i].line}`).join(", ")];
  });
  const openingDifference=cents(input.opening)*direction-cents(ledgerOpening);
  const closingDifference=cents(input.closing)*direction-cents(ledgerClosing);
  return {title:"Statement reconciliation",href:"/accounting#statements",
    scope:`${input.account} · ${input.currency} · ${input.from} to ${input.to}. Statement signs ${input.direction==="same"?"agree with":"are inverted to match"} ledger debit-minus-credit. Exact date/reference/amount matching only; timing differences, combined payments and missing references require review. Matches are proposals, not bank clearing, allocations or posted corrections.`,
    tables:[{heading:"Balance control",columns:["Control",input.currency],rows:[["Statement opening (ledger sign)",decimal(cents(input.opening)*direction)],["Ledger opening",ledgerOpening],["Opening difference",decimal(openingDifference)],["Statement closing (ledger sign)",decimal(cents(input.closing)*direction)],["Ledger closing",ledgerClosing],["Closing difference",decimal(closingDifference)]]},
      {heading:"Statement entries",columns:["CSV row","Date","Reference","Description","Statement amount","Ledger-sign amount","Result","JV / line candidates"],rows:details},
      {heading:"Ledger entries without a unique match",columns:["Date","JV","Line","Reference","Description","Amount"],rows:ledger.flatMap((r,i)=>used.has(i)?[]:[[r.date,r.number,String(r.line),r.reference,r.description,decimal(cents(r.debit)-cents(r.credit))]])}],
    facts:{statementEntries:rows.length,ledgerEntries:ledger.length,matched,ambiguous,unmatched:rows.length-matched-ambiguous,unmatchedLedger:ledger.length-used.size,openingDifference:decimal(openingDifference),closingDifference:decimal(closingDifference),currency:input.currency,executed:false}};
}
