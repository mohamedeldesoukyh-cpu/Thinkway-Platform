import {cents, decimal} from "@/features/accounting/journal-model";
import type {LedgerRow} from "./ledger-details";

type StatementRow={date:string;reference:string;description:string;amount:string};
const normalize=(value:string)=>value.trim().normalize("NFKC").toLocaleUpperCase("en-US");
const amount=(row:LedgerRow)=>cents(row.debit)-cents(row.credit);

/** Diagnostic candidates never consume rows or change the exact-match result.
 * Each unmatched source row contributes exactly once to the difference bridge. */
export function reconciliationDifferences(rows:StatementRow[],ledger:LedgerRow[],matchedRows:Set<number>,matchedLedger:Set<number>,direction:bigint,to:string){
 const unmatchedLedger=ledger.flatMap((row,index)=>matchedLedger.has(index)?[]:[row]);
 const unmatchedStatement=rows.flatMap((row,index)=>matchedRows.has(index)?[]:[{row,index}]);
 const details:string[][]=[];
 const age=(date:string)=>String(Math.max(0,Math.floor((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${date}T00:00:00Z`))/86400000)));
 let statementTotal=BigInt(0),ledgerTotal=BigInt(0);
 for(const {row,index} of unmatchedStatement){
  const value=cents(row.amount)*direction;statementTotal+=value;
  const sameReference=normalize(row.reference)?unmatchedLedger.filter(l=>normalize(l.reference)===normalize(row.reference)):[];
  const sameAmount=sameReference.filter(l=>amount(l)===value);
  const duplicate=rows.filter(r=>r.date===row.date&&normalize(r.reference)===normalize(row.reference)&&cents(r.amount)*direction===value).length>1;
  let finding="No exact ledger match in the selected account, currency and period.";
  let possible="Unrecorded entry, other account or period, or reference mismatch; cause unconfirmed.";
  let action="Check the source document and adjacent periods/accounts. Prepare an entry only after confirming it is missing.";
  if(duplicate||sameReference.length>1){
   finding=duplicate?"Repeated statement date/reference/amount; duplicate transaction not established.":"Multiple ledger entries have this reference; allocation is not established.";
   possible="Repeated statement rows, valid repeated transactions, split payment or duplicate posting.";
   action="Compare original documents and all candidate lines. Confirm allocation or duplicate status before any correction.";
  }else if(sameAmount.length===1){
   finding=`Same reference and signed amount on ledger date ${sameAmount[0].date}; dates differ.`;
   possible="Value-date versus posting-date timing difference; not confirmed.";
   action="Verify bank value date and journal date. If valid timing, retain as a reconciling item; do not post another entry.";
  }else if(sameReference.length===1){
   finding=`Same reference; statement minus candidate ledger amount = ${decimal(value-amount(sameReference[0]))}.`;
   possible=value===-amount(sameReference[0])?"Opposite sign: possible reversal or sign convention error.":"Partial settlement, fee deduction or incorrect amount; not confirmed.";
   action="Compare invoice, payment evidence and ledger line. Confirm the reason and exact correction before posting.";
  }else if(/bank\s*(fee|charge)|commission|رسوم|عمول/iu.test(row.description)){
   possible="Description suggests a fee or commission; classification and missing-entry status are unconfirmed.";
   action="Check bank advice, tax treatment and other accounts. If genuinely unrecorded, propose the verified expense/cash entry for approval.";
  }
  details.push([`Statement row ${index+2}`,row.date,row.reference,row.description,decimal(value),age(row.date),finding,possible,action,sameReference.map(l=>`${l.number} / ${l.line}: ${l.date}, ${decimal(amount(l))}`).join("; ")||"None by reference"]);
 }
 for(const row of unmatchedLedger){
  const value=amount(row);ledgerTotal+=value;
  const candidates=normalize(row.reference)?unmatchedStatement.filter(s=>normalize(s.row.reference)===normalize(row.reference)):[];
  details.push([`Ledger ${row.number} / ${row.line}`,row.date,row.reference,row.description,decimal(-value),age(row.date),candidates.length?"Ledger entry has no unique exact match; statement candidates share its reference.":"Ledger entry has no exact statement match in the selected period.","Outstanding settlement, timing, incomplete statement, reference mismatch or duplicate posting; cause unconfirmed.","Trace payment and original supporting documents. Check subsequent clearing and earlier reconciliation before changing the ledger.",candidates.map(s=>`Statement row ${s.index+2}: ${s.row.date}, ${decimal(cents(s.row.amount)*direction)}`).join("; ")||"None by reference"]);
 }
 return {details,statementTotal,ledgerTotal};
}
