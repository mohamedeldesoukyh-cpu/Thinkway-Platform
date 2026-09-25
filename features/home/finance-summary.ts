import {isActiveInvoiceForFinancialTotals} from '../../lib/finance/status/invoice-status';

export function homeInvoiceBalances(invoices:Array<{status:string;regeneration_status?:string|null;issue_date?:string|null;due_date?:string|null;total:number;amount_paid:number;currency:string}>,convert:(amount:number,currency:string)=>number,today:string){
 let outstanding=0,overdue=0,count=0;
 for(const i of invoices){
  if(!i.issue_date||!isActiveInvoiceForFinancialTotals(i))continue;
  const balance=convert(Math.max(0,Number(i.total)-Number(i.amount_paid)),i.currency);
  outstanding+=balance;
  if(balance>0&&i.due_date&&i.due_date<today){overdue+=balance;count++;}
 }
 return {outstanding,overdue,count};
}

export function homePoSummary(rows:Array<{amount:number;consumed:number}>){
 const covered=rows.filter(r=>r.amount>0);
 const total=covered.reduce((s,r)=>s+r.amount,0),consumed=covered.reduce((s,r)=>s+r.consumed,0);
 return {total,consumed,percent:total>0?Math.round(consumed/total*100):0,missing:rows.length-covered.length};
}

export function homeCreatorOutstanding(fee:number,status:string,entries:Array<{status:string;cleared_at:string|null;original_amount:number}>){
 const paid=entries.reduce((s,e)=>s+(e.status==='paid'&&!e.cleared_at?Number(e.original_amount):0),0);
 // Legacy paid assignments without ledger entries are settled, not a new obligation.
 return Math.max(0,fee-(entries.length===0&&status==='paid'?fee:paid));
}
