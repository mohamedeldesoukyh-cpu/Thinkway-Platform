import { cents, money } from './journal-model';
import { financialTotals, type FinancialAccount } from './financial-model';
import type { FormattedReport } from './formatted-report-model';
import type { Account } from './chart';
export type FinancialSource={currency:string;accounts:{account:string;name:string;currency:string;opening:string;debit:string;credit:string;closing:string}[];auxiliaries:{account:string;currency:string;id:string|null;name:string|null;opening:string;debit:string;credit:string;closing:string}[]};
export function financialReportSections(source:FinancialSource,chart:Account[],mode:'profit'|'balance'|'trial',byAccount:boolean,byAuxiliary:boolean,byThirdParty=false):FormattedReport['sections']{
 const third=(code:string)=>['Customer','Supplier / creator','Employee'].includes(chart.find(a=>a.code===code)?.directoryKind??chart.find(a=>a.code===code)?.subledger??'');
 const detail=(code:string)=>third(code)?byThirdParty:byAuxiliary;
 const currencies=[...new Set(source.accounts.map(a=>a.currency))];if(!currencies.length)currencies.push(source.currency);
 return currencies.map(currency=>{
  const all:FinancialAccount[]=source.accounts.filter(a=>a.currency===currency).map(a=>({...a,code:a.account,type:chart.find(c=>c.code===a.account)?.type??'Unknown'}));
  if(!all.length)return {heading:currency+' · '+(mode==='trial'?'Trial balance':mode==='profit'?'Profit & Loss':'Balance Sheet'),columns:['Code','Name',...(mode==='trial'?['Opening','Debit','Credit','Closing','Debtor','Creditor']:['Classification','Balance'])],rows:[]};
  if(mode==='trial'){const totals=(values:FinancialAccount[])=>[...['opening','debit','credit','closing'].map(k=>money(values.reduce((n,a)=>n+cents(a[k as keyof FinancialAccount]),BigInt(0)))),...([1,-1] as const).map(sign=>money(values.reduce((n,a)=>{const b=cents(a.closing)*BigInt(sign);return n+(b>BigInt(0)?b:BigInt(0));},BigInt(0))))];const rows:string[][]=[];if(byAccount||byAuxiliary||byThirdParty){for(const a of all){rows.push([a.code,a.name,...totals([a])]);if(detail(a.code))for(const aux of source.auxiliaries.filter(x=>x.account===a.code&&x.currency===currency))rows.push(['',aux.name??'No auxiliary',...totals([{...a,...aux,name:aux.name??a.name}])]);}}else{const groups=new Map<string,FinancialAccount[]>();for(const a of all){const parent=chart.find(c=>c.code===chart.find(c=>c.code===a.code)?.parent);const key=parent?.code??a.type;groups.set(key,[...(groups.get(key)??[]),a]);}for(const [key,accounts] of groups)rows.push([key,chart.find(c=>c.code===key)?.name??key,...totals(accounts)]);}rows.push(['','Total',...totals(all)]);return {heading:currency+' · Trial balance',columns:['Code','Name','Opening','Debit','Credit','Closing','Debtor','Creditor'],rows};}
  const visible=all.filter(a=>(mode==='profit'?['Revenue','Expense']:['Asset','Liability','Equity']).includes(a.type));
  const amount=(a:FinancialAccount)=>mode==='profit'?cents(a.credit)-cents(a.debit):a.type==='Asset'?cents(a.closing):-cents(a.closing);
  const rows:string[][]=[];
  if(byAccount||byAuxiliary||byThirdParty){for(const a of visible){rows.push([a.code,a.name,a.type,money(amount(a))]);if(detail(a.code))for(const aux of source.auxiliaries.filter(x=>x.account===a.code&&x.currency===currency))rows.push(['',aux.name??'No auxiliary', 'Auxiliary detail',money(amount({...a,...aux,name:aux.name??a.name}))]);}}
  else {const groups=new Map<string,{name:string;type:string;amount:bigint}>();for(const a of visible){const account=chart.find(c=>c.code===a.code),parent=chart.find(c=>c.code===account?.parent),key=parent?.code??a.type;const g=groups.get(key)??{name:parent?.name??a.type,type:a.type,amount:BigInt(0)};g.amount+=amount(a);groups.set(key,g);}for(const [code,g]of groups)rows.push([code,g.name,g.type,money(g.amount)]);}
  const totals=financialTotals(all);
  if(mode==='balance')rows.push(['','Unclosed earnings','Equity',totals.earnings]);
  rows.push(...(mode==='profit'?[['','Net profit / (loss)','Total',totals.profit]]:[['','Total assets','Total',totals.assets],['','Total liabilities','Total',totals.liabilities],['','Equity including unclosed earnings','Total',totals.equityIncludingEarnings],['','Balance difference','Total',totals.difference]]));
  return {heading:currency+' · '+(byAuxiliary?'Account and auxiliary detail':byAccount?'Account detail':'Summary'),columns:['Code','Name','Classification',mode==='profit'?'Income / (expense)':'Balance'],rows};
 });
}
