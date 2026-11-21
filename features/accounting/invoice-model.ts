import { cents,decimal } from './journal-model';
export type InvoiceSubmission={invoice_id:string;company_id:string;client_code:string;client_name:string;source:{number:string;date:string;currency:string;net:string;vat:string;total:string};status:'submitted'|'posted';version:number;journal_id:string|null;voucher:string|null;reversal:string|null};
export function invoicePreview(source:InvoiceSubmission['source'],receivable:string,revenue:string,vat:string){
 const net=cents(source.net),tax=cents(source.vat),total=cents(source.total);
 if(net<=BigInt(0)||tax<BigInt(0)||total!==net+tax)throw new Error('Invoice totals do not reconcile');
 return [{account:receivable,debit:decimal(total),credit:'0.00'},
 {account:revenue,debit:'0.00',credit:decimal(net)},...(tax>BigInt(0)?[{account:vat,debit:'0.00',credit:decimal(tax)}]:[])];
}
