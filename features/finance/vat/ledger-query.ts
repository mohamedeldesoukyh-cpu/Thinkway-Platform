import {createSupabaseServerClient} from '@/lib/supabase/server';
import {requireFinancePermission} from '@/lib/auth/permissions-server';
import {planningDb} from '@/lib/supabase/governance-client';
import type {VatLedger} from './ledger-model';
export async function loadVatLedger():Promise<VatLedger>{
 const db=await createSupabaseServerClient();const auth=await requireFinancePermission(db,'finance.read');if('error' in auth)throw new Error(auth.error);
 const all=async(table:string,columns:string)=>{let rows:any[]=[];for(let offset=0;;offset+=1000){const r=await planningDb(db).from(table).select(columns).order('id').range(offset,offset+999);if(r.error)throw new Error('VAT records unavailable. Please reload or check Finance access.');rows.push(...r.data??[]);if((r.data?.length??0)<1000)return rows;}};
 const [invoices,suppliers,payments,costs]=await Promise.all([all('invoices','id,document_number,issue_date,currency,status,revenue_vat_amount,billing_country_code,client:clients(name,country)'),all('creator_supplier_invoices','*'),all('vat_authority_payments','*'),all('campaign_lines','id,currency_code,cost_vat_amount')]);
 const country=(v:string|undefined)=>{const c=(v??'').trim().toUpperCase();return ({EGYPT:'EG','UNITED ARAB EMIRATES':'AE',UAE:'AE','SAUDI ARABIA':'SA'} as Record<string,string>)[c]??(c.length===2?c:'Unspecified');};
 const provisional=new Map<string,number>();for(const row of costs){if(Number(row.cost_vat_amount))provisional.set(row.currency_code||'Unspecified',(provisional.get(row.currency_code||'Unspecified')??0)+Number(row.cost_vat_amount));}
 return {entries:[...invoices.filter(i=>!['void','draft'].includes(i.status)&&i.issue_date).map(i=>({id:i.id,date:i.issue_date,name:i.client?.name??'Not set',invoice:i.document_number,country:country(i.billing_country_code||i.client?.country),currency:i.currency,vatIn:Number(i.revenue_vat_amount??0),vatOut:0,source:'Client invoice'})),...suppliers.filter(i=>i.status==='received'&&i.confirmed).map(i=>({id:i.id,date:i.invoice_date,name:i.supplier_name,invoice:i.invoice_number,country:i.country_code,currency:i.currency,vatIn:0,vatOut:Number(i.vat_amount),source:'Creator invoice'}))],payments:payments.map(p=>({...p,amount:Number(p.amount)})),provisional:[...provisional].map(([currency,amount])=>({currency,amount}))};
}
