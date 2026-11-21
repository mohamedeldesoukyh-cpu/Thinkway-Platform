import { cents,decimal } from './journal-model';
export type InvoiceSubmission={invoice_id:string;company_id:string;client_id?:string;client_code:string;client_name:string;source:{number:string;date:string;currency:string;net:string;vat:string;total:string};status:'submitted'|'posted'|'pending';version:number;journal_id:string|null;voucher:string|null;reversal:string|null};
export type InvoiceFx={currency:string;base:string;rate:string;date:string;plan?:{lines:{account:string;description:string;foreignDebit:string;foreignCredit:string;debit:string;credit:string}[];components:{combined_legacy:boolean}}};
export function convertInvoiceAmount(amount:string,rate:string):string {
 if(!/^\d+(\.\d{1,8})?$/.test(rate))throw new Error('Invalid exchange rate');
 const [whole,fraction='']=rate.split('.');const scaled=BigInt(whole)*BigInt(100000000)+BigInt(fraction.padEnd(8,'0'));
 if(scaled<=BigInt(0))throw new Error('Invalid exchange rate');
 return decimal((cents(amount)*scaled+BigInt(50000000))/BigInt(100000000));
}
export function localInvoicePreview(source:InvoiceSubmission['source'],rate:string,receivable:string,revenue:string,vat:string){
 invoicePreview(source,receivable,revenue,vat);
 const net=convertInvoiceAmount(source.net,rate),tax=convertInvoiceAmount(source.vat,rate);
 if(cents(net)<=BigInt(0)||(cents(source.vat)>BigInt(0)&&cents(tax)<=BigInt(0)))throw new Error('Converted invoice line is below one base-currency cent');
 return invoicePreview({...source,net,vat:tax,total:decimal(cents(net)+cents(tax))},receivable,revenue,vat);
}
export function invoicePreview(source:InvoiceSubmission['source'],receivable:string,revenue:string,vat:string){
 const net=cents(source.net),tax=cents(source.vat),total=cents(source.total);
 if(net<=BigInt(0)||tax<BigInt(0)||total!==net+tax)throw new Error('Invoice totals do not reconcile');
 return [{account:receivable,debit:decimal(total),credit:'0.00'},
 {account:revenue,debit:'0.00',credit:decimal(net)},...(tax>BigInt(0)?[{account:vat,debit:'0.00',credit:decimal(tax)}]:[])];
}
