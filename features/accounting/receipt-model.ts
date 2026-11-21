import { cents,decimal,type JournalLine } from './journal-model';
export type ReceiptQuote={currency:string;base:string;rate:string;date:string;amount:string;cash:string;receivable:string;gain:string;account:string;invoiceVersion:number;settled:string;settledBase:string;minPostingDate:string};
export type Receipt={id:string;document_number:string;invoice_id:string;invoice_number:string;client_code:string;client_name:string;amount:string;currency:string;date:string;method:string;reference:string|null;revision:number;status:'unposted'|'posted'|'reversed';voucher:string|null;reversal:string|null;advance:boolean};
export type ReceiptInvoice={id:string;number:string;client_code:string;client_name:string;currency:string;total:string;paid:string;outstanding:string;date:string;accounting_outstanding:string};
export function receiptPreview(q:ReceiptQuote,cash:string,gain:string,loss:string):JournalLine[]{
 const difference=cents(q.cash)-cents(q.receivable);
 const lines:JournalLine[]=[{account:cash,description:'Cash / bank receipt',debit:q.cash,credit:'0',foreignDebit:q.amount,foreignCredit:'0'},{account:q.account,description:'Customer receivable',debit:'0',credit:q.receivable,foreignDebit:'0',foreignCredit:q.amount}];
 if(difference!==BigInt(0))lines.push({account:difference>BigInt(0)?gain:loss,description:'Realized exchange difference',debit:decimal(difference<BigInt(0)?-difference:BigInt(0)),credit:decimal(difference>BigInt(0)?difference:BigInt(0)),foreignDebit:null,foreignCredit:null});
 return lines;
}
