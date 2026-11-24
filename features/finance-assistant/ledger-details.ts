import { z } from "zod";
import type { FinanceReportClient } from "./report-tools";
const amount=z.string().regex(/^-?\d+(\.\d+)?$/);
export const ledgerRowSchema=z.object({id:z.string(),line:z.number().int(),account:z.string(),name:z.string(),date:z.string(),number:z.string(),reference:z.string().nullable().transform(v=>v??""),description:z.string().nullable().transform(v=>v??""),party:z.string().nullable(),report_currency:z.string(),debit:amount,credit:amount,balance:amount});
export type LedgerRow=z.infer<typeof ledgerRowSchema>;
export async function readLedgerDetails(db:FinanceReportClient,args:Record<string,unknown>,first:unknown):Promise<LedgerRow[]>{
 const schema=z.object({rows:z.array(ledgerRowSchema),count:z.number().int().nonnegative()});
 const initial=schema.parse(first);
 if(initial.count>1000)throw Error("Narrow the report to at most 1,000 ledger entries.");
 const rows=[...initial.rows];
 for(let offset=100;rows.length<initial.count&&offset<initial.count;offset+=100){
  const next=await db.rpc("tw_accounting_statement_filtered",{...args,p_offset:offset});
  if(next.error)throw Error("Ledger details unavailable.");
  const page=schema.parse(next.data);
  if(page.count!==initial.count)throw Error("The ledger changed during retrieval. Refresh the report.");
  rows.push(...page.rows);
 }
 if(rows.length!==initial.count||new Set(rows.map(r=>`${r.id}:${r.line}:${r.report_currency}`)).size!==rows.length)throw Error("Incomplete or changing ledger details. Refresh the report.");
 return rows;
}
