import {cents,money} from './journal-model';
export type AccrualItem={assignment:string;reference:string;campaign:string;component:string;label?:string;currency:string;amount:string;baseAmount:string;rate:string;account:string;counter:string;auxiliary:string|null;auxiliaryLabel?:string|null;clientCode:string};
export type AccrualPlan={date:string;base:string;token:string;items:AccrualItem[]};
export function accrualRows(plan:AccrualPlan,reverse:boolean){return plan.items.flatMap(x=>{
 const debit=x.component.endsWith('_cost')!==reverse;
 return [[x.reference,x.campaign,x.label??x.component.replaceAll('_',' '),x.account,x.auxiliaryLabel??'',x.currency,money(x.amount),debit?money(x.baseAmount):'0.00',debit?'0.00':money(x.baseAmount)],
 [x.reference,x.campaign,x.label??x.component.replaceAll('_',' '),x.counter,x.component.endsWith('_cost')?'':x.clientCode,x.currency,money(x.amount),debit?'0.00':money(x.baseAmount),debit?money(x.baseAmount):'0.00']];
});}
export const accrualTotal=(plan:AccrualPlan)=>money(plan.items.reduce((sum,x)=>sum+cents(x.baseAmount),BigInt(0)));
