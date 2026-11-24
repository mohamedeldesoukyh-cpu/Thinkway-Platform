import {z} from "zod";
import {cents,decimal} from "@/features/accounting/journal-model";
import {partyCode} from "@/features/accounting/party-code";
import {isWithin} from "@/features/accounting/chart-model";
import type {AccountingSetup} from "@/features/accounting/setup-types";
import type {FinancePlan,FinanceEvidence} from "./contracts";
import type {FinanceReportClient} from "./report-tools";
import {ledgerRowSchema} from "./ledger-details";

type Plan=Extract<FinancePlan,{action:"accounting_analysis"}> & {from:string;to:string};
const rowSchema=ledgerRowSchema.extend({client_id:z.string().nullable(),client_code:z.string().nullable(),client_name:z.string().nullable(),vendor_id:z.string().nullable(),vendor_name:z.string().nullable(),campaign_id:z.string().nullable(),campaign_name:z.string().nullable(),attribution:z.string()});
type Row=z.infer<typeof rowSchema>;
const captions={client:"Client",vendor:"Supplier / creator",campaign:"Campaign",account:"Account",month:"Month",type:"Transaction type",revenue:"Revenue",cost:"Direct cost",gross_profit:"Gross profit",margin:"GP %",debit:"Debit",credit:"Credit",net:"Net debit / (credit)"};
const areaGroups:Record<Plan["area"],string[]>={all:[],profitability:["410000","510000"],revenue:["400000"],direct_cost:["510000"],expenses:["500000","600000","700000","800000"],banking:["110000"],tax:["140000","230000","800000"],fixed_assets:["150000","633000"],receivables:["120000"],payables:["210000"]};
type Totals={revenue:bigint;cost:bigint;debit:bigint;credit:bigint;count:number};
const zero=():Totals=>({revenue:BigInt(0),cost:BigInt(0),debit:BigInt(0),credit:BigInt(0),count:0});
function values(t:Totals,measures:Plan["measures"]){return measures.map(m=>m==="margin"?t.revenue===BigInt(0)?"—":decimal((t.revenue-t.cost)*BigInt(10000)/t.revenue):decimal(m==="gross_profit"?t.revenue-t.cost:m==="net"?t.debit-t.credit:t[m]));}

/** Only validated ledger amounts enter calculations. Unknown attribution is retained. */
export function aggregateAccountingRows(rows:Row[],setup:AccountingSetup,plan:Plan){
 const chart=setup.accounts;
 const within=(code:string,root:string)=>!!chart.find(a=>a.code===code&&isWithin(a,root,chart));
 const groups=new Map<string,{currency:string;labels:string[];totals:Totals}>();
 const controls=new Map<string,Totals>();
 let unassigned=0;
 for(const row of rows){
  if(row.transaction_type==="closing")continue;
  const account=chart.find(a=>a.code===row.account);
  if(!account)throw Error("Report account is missing from the chart.");
  if(areaGroups[plan.area].length&&!areaGroups[plan.area].some(root=>within(row.account,root)))continue;
  if(plan.accounts.length&&!plan.accounts.some(root=>within(row.account,root)||row.account.startsWith(root)))continue;
  const revenue=account.type==="Revenue"?cents(row.credit)-cents(row.debit):BigInt(0);
  const cost=within(row.account,"510000")?cents(row.debit)-cents(row.credit):BigInt(0);
  if(!row.client_id&&(revenue!==BigInt(0)||cost!==BigInt(0)))unassigned++;
  const ids=plan.groupBy.map(g=>g==="client"?row.client_id:g==="vendor"?row.vendor_id:g==="campaign"?row.campaign_id:g==="account"?row.account:g==="month"?row.date.slice(0,7):row.transaction_type);
  const labels=plan.groupBy.map(g=>g==="client"?row.client_id?`${partyCode(row.client_code)} · ${row.client_name??"Name unavailable"}`:"Unassigned client":g==="vendor"?row.vendor_name??"Unassigned supplier":g==="campaign"?row.campaign_name??"Unassigned campaign":g==="account"?`${row.account} · ${row.name}`:g==="month"?row.date.slice(0,7):row.transaction_type??"Unknown");
  const key=JSON.stringify([row.report_currency,...ids]);
  const group=groups.get(key)??{currency:row.report_currency,labels,totals:zero()};
  groups.set(key,group);
  const control=controls.get(row.report_currency)??zero();controls.set(row.report_currency,control);
  for(const total of [group.totals,control]){total.revenue+=revenue;total.cost+=cost;total.debit+=cents(row.debit);total.credit+=cents(row.credit);total.count++;}
 }
 const measures=[...new Set(plan.measures)];
 const tables=[...controls].sort(([a],[b])=>a.localeCompare(b)).map(([currency,total])=>({orientation:"portrait" as const,heading:`${plan.title} · ${currency}`,columns:[...plan.groupBy.map(g=>captions[g]),...measures.map(m=>captions[m])],rows:[...[...groups.values()].filter(g=>g.currency===currency).sort((a,b)=>a.labels.join().localeCompare(b.labels.join())).map(g=>[...g.labels,...values(g.totals,measures)]),["Total",...plan.groupBy.slice(1).map(()=>""),...values(total,measures)]]}));
 if(!tables.length)tables.push({orientation:"portrait",heading:plan.title,columns:[...plan.groupBy.map(g=>captions[g]),...measures.map(m=>captions[m])],rows:[]});
 return {tables,unassigned,totals:[...controls].map(([currency,t])=>({currency,revenue:decimal(t.revenue),cost:decimal(t.cost),grossProfit:decimal(t.revenue-t.cost),count:t.count}))};
}

export async function accountingAnalysis(db:FinanceReportClient,setup:AccountingSetup,plan:Plan,yearId:string|null):Promise<FinanceEvidence>{
 if(plan.measures.some(m=>["cost","gross_profit","margin"].includes(m))&&plan.area!=="profitability"&&plan.area!=="direct_cost")throw Error("Cost and gross-profit measures require the profitability or direct-cost scope.");
 if(plan.measures.some(m=>["gross_profit","margin"].includes(m))&&plan.area!=="profitability")throw Error("Gross profit requires both revenue and direct costs.");
 const company=setup.company!;
 let clientId:string|null=null;
 if(plan.clientName){
  const lookup=await db.rpc("tw_accounting_party_lookup",{p_company:company.id,p_kind:"client",p_search:plan.clientName,p_selected:null});
  if(lookup.error)throw Error("Client lookup unavailable.");
  const candidates=z.array(z.object({id:z.string().uuid(),name:z.string()})).parse(lookup.data);
  if(candidates.length!==1)return {title:"Client selection",href:"/accounting#amgad",scope:"Choose the exact client before preparing the report.",facts:{candidates:candidates.slice(0,10)}};
  clientId=candidates[0].id;
 }
 const filters=plan.accounts.length?plan.accounts:areaGroups[plan.area];
 const response=await db.rpc("tw_finance_analysis_snapshot",{p_company:company.id,p_from:plan.from,p_to:plan.to,p_accounts:filters.join(",")||null,p_display:plan.display});
 if(response.error)throw Error("Accounting analysis unavailable. No partial figures have been used.");
 const snapshot=z.object({rows:z.array(rowSchema).max(10000),count:z.number().int()}).parse(response.data);
 if(snapshot.count!==snapshot.rows.length||new Set(snapshot.rows.map(r=>`${r.id}:${r.line}:${r.report_currency}`)).size!==snapshot.count)throw Error("Incomplete accounting analysis.");
 const selected=clientId?snapshot.rows.filter(r=>r.client_id===clientId):snapshot.rows;
 const result=aggregateAccountingRows(selected,setup,plan);
 const unresolved=snapshot.rows.filter(r=>!r.client_id).length;
 if(plan.includeTransactions)result.tables.push({orientation:"portrait",heading:"Requested transaction detail",columns:["Date","Document","Account","Client","Description","Currency","Debit","Credit"],rows:selected.filter(r=>r.transaction_type!=="closing").map(r=>[r.date,r.document_number??r.number,r.account,r.client_name??"Unassigned",r.description,r.report_currency,r.debit,r.credit])});
 return {title:plan.title,href:`/accounting?company=${company.id}${yearId?`&year=${yearId}`:""}#amgad`,reportPlan:plan,tables:result.tables,
  scope:`${company.name} · ${plan.from} to ${plan.to} · Posted Accounting ledger including unlocked entries; closing entries excluded. Revenue and direct costs use configured chart groups; GP = revenue less direct cost, before overheads and tax. Client/campaign attribution uses source links; unassigned entries are never allocated by assumption. ${clientId&&unresolved?`${unresolved} entries without client attribution cannot be included in this client's figures.`:result.unassigned?`${result.unassigned} revenue/cost entries need attribution review; client GP is provisional.`:""}`,
  facts:{company:company.name,from:plan.from,to:plan.to,area:plan.area,groupBy:plan.groupBy,measures:plan.measures,totals:result.totals,unassignedEntries:clientId?unresolved:result.unassigned,provisional:clientId?unresolved>0:result.unassigned>0,accountingBasis:true}};
}
