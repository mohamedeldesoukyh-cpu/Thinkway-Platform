import {isActiveInvoiceForFinancialTotals,getInvoiceRegisterStatusLabel} from '../../../lib/finance/status/invoice-status';
export function vatInvoiceEligibility(invoice:{status:string;regeneration_status?:string|null;issue_date?:string|null}){return {included:isActiveInvoiceForFinancialTotals(invoice)&&!!invoice.issue_date,status:invoice.regeneration_status==='regenerated'?'Superseded':getInvoiceRegisterStatusLabel(invoice)};}
export type VatEntry={id:string;date:string;name:string;invoice:string;country:string;currency:string;vatIn:number;vatOut:number;source:string;status?:string;included?:boolean};
export type VatPayment={id:string;period:string;country_code:string;currency:string;amount:number;paid_at:string;method:string;reference:string;authority:string;notes:string|null};
export type VatLedger={entries:VatEntry[];payments:VatPayment[];provisional:{currency:string;amount:number}[]};
export const roundVat=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function vatMonths(data:VatLedger){
 const map=new Map<string,{period:string;country:string;currency:string;vatIn:number;vatOut:number;paid:number;balance:number;payable:number;credit:number}>();
 const get=(period:string,country:string,currency:string)=>{const k=[period,country,currency].join('|');if(!map.has(k))map.set(k,{period,country,currency,vatIn:0,vatOut:0,paid:0,balance:0,payable:0,credit:0});return map.get(k)!;};
 for(const e of data.entries){if(e.included===false||!e.date)continue;const r=get(e.date.slice(0,7),e.country,e.currency);r.vatIn+=e.vatIn;r.vatOut+=e.vatOut;}
 for(const p of data.payments)get(p.period.slice(0,7),p.country_code,p.currency).paid+=p.amount;
 return [...map.values()].map(r=>{const balance=roundVat(r.vatIn-r.vatOut);const remaining=roundVat(balance-r.paid);return {...r,vatIn:roundVat(r.vatIn),vatOut:roundVat(r.vatOut),paid:roundVat(r.paid),balance,payable:Math.max(0,remaining),credit:Math.max(0,-remaining)};}).sort((a,b)=>b.period.localeCompare(a.period)||a.country.localeCompare(b.country)||a.currency.localeCompare(b.currency));
}

/** Running unpaid balance by tax country and currency, including prior credits. */
export function accumulatedVatMonths(data: VatLedger) {
  const balances = new Map<string, number>();
  return vatMonths(data).reverse().map(row => {
    const key = `${row.country}|${row.currency}`;
    const opening = balances.get(key) ?? 0;
    const accumulated = roundVat(opening + row.balance - row.paid);
    balances.set(key, accumulated);
    return { ...row, opening, accumulated, payable: Math.max(0, accumulated), credit: Math.max(0, -accumulated) };
  }).reverse();
}
