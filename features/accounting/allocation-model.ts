import { cents,decimal } from './journal-model';
export type Party={id:string;code:string;name:string;legal_name?:string|null;username?:string|null;display_name?:string|null};
export type OpenItem={id:string;number:string;date:string;due:string|null;total:string;settled:string;outstanding:string;currency:string;account:string;status?:string};
export type Allocation={id:string;amount:string};
export type SettlementQuote={currency:string;base:string;rate:string;date:string;amount:string;cash:string;allocated:string;carrying:string;advance:string;advanceBase:string;gain:string;lines:{id:string;number:string;amount:string;base:string}[]};
export type Voucher={journal_id:string;id:string;kind:string;client_id:string|null;vendor_id:string|null;party_code:string;party_name:string;number:string;date:string;currency:string;amount:string|number;control_account:string;advance_account:string;advance_remaining:string;status:string;voucher_number:string;parent_id:string|null;request:{quote:SettlementQuote;value:Record<string,unknown>}};
export function automaticAllocation(amount:string,items:OpenItem[]):Allocation[]{
 let left=cents(amount);if(left<=BigInt(0))throw new Error('Enter a positive voucher amount');
 const sorted=[...items].sort((a,b)=>(a.due??'9999-12-31').localeCompare(b.due??'9999-12-31')||a.date.localeCompare(b.date)||a.number.localeCompare(b.number)||a.id.localeCompare(b.id));
 const result:Allocation[]=[];for(const item of sorted){const open=cents(item.outstanding);if(open<=BigInt(0)||left<=BigInt(0))continue;const use=left<open?left:open;result.push({id:item.id,amount:decimal(use)});left-=use;}return result;
}
export function unallocated(amount:string,lines:Allocation[]):string{return decimal(cents(amount||'0')-lines.reduce((n,l)=>n+cents(l.amount||'0'),BigInt(0)));}
export const accountingToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
