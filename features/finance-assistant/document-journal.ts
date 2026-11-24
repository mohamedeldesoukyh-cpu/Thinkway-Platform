import {z} from "zod";
import {cents} from "@/features/accounting/journal-model";
import {journalLineSchema} from "@/features/accounting/journal-validation";
import type {AccountingSetup} from "@/features/accounting/setup-types";
const line=z.object({account:z.string().regex(/^\d{6}$/),description:z.string().max(500),debit:z.string(),credit:z.string(),source:z.string().min(1).max(160)}).strict().refine(value=>journalLineSchema.safeParse(value).success,"Each proposed line must contain a valid debit or credit.");
export const documentJournalSchema=z.object({date:z.string().date(),reference:z.string().max(120),memo:z.string().min(3).max(900),currency:z.string().regex(/^[A-Z]{3}$/),warnings:z.array(z.string().max(500)).max(20),lines:z.array(line).min(2).max(100)}).strict();
export type DocumentJournal=z.infer<typeof documentJournalSchema>;
export function validateDocumentJournal(raw:unknown,setup:AccountingSetup,yearId:string){
 const value=documentJournalSchema.parse(raw);
 const year=setup.years.find(y=>y.id===yearId);
 if(!setup.company||!year||year.closed||value.date<year.start_date||value.date>year.end_date)throw Error("The document must belong to the selected open fiscal year.");
 if(value.currency!==setup.company.base_currency)throw Error("Foreign-currency documents require verified exchange rates. Enter this document through the normal transaction screen.");
 if(value.lines.some(l=>!setup.accounts.some(a=>a.code===l.account&&a.active&&(a.kind==="Posting"||a.kind==="Control"))))throw Error("A proposed account is unavailable. Review the chart of accounts before continuing.");
 if(value.lines.reduce((sum,l)=>sum+cents(l.debit)-cents(l.credit),BigInt(0))!==BigInt(0))throw Error("The proposed entry does not balance. Review the source document; no balancing plug was added.");
 return value;
}
