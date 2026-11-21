import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountingContext } from '@/features/accounting/setup-server';
import { isoDate } from '@/features/accounting/journal-validation';
import { assertCsrfRequest } from '@/lib/security/csrf';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const message=(e:unknown)=>e instanceof z.ZodError?e.issues[0]?.message:e instanceof Error?e.message:'Invoice request failed';
const requestSchema=z.object({invoice:z.string().uuid(),company:z.string().uuid(),version:z.number().int().positive(),date:isoDate,receivable:z.string().regex(/^\d{6}$/),revenue:z.string().regex(/^\d{6}$/),vat:z.string().regex(/^\d{6}$/).nullable()});
export async function GET(request:Request){
 try{
  const {db}=await accountingContext();const q=new URL(request.url).searchParams;
  const company=z.string().uuid().parse(q.get('company'));const page=z.coerce.number().int().min(0).max(100000).parse(q.get('page')??0);
  const result=await db.from('tw_accounting_invoice_submissions').select('invoice_id,company_id,client_code,client_name,source,status,version,journal_id,submitted_at',{count:'exact'}).eq('company_id',company).neq('status','withdrawn').order('submitted_at',{ascending:false}).order('invoice_id').range(page*50,page*50+49);
  if(result.error)throw new Error(result.error.message);
  const ids=(result.data??[]).map(s=>s.journal_id).filter(Boolean);
  const [journals,reversals]=ids.length?await Promise.all([
   db.from('tw_accounting_journals').select('id,voucher_number').in('id',ids),
   db.from('tw_accounting_journals').select('id,voucher_number,reversal_of').in('reversal_of',ids),
  ]):[{data:[],error:null},{data:[],error:null}];
  if(journals.error||reversals.error)throw new Error('Could not load posting status');
  return reply({rows:(result.data??[]).map(s=>({...s,voucher:journals.data?.find(j=>j.id===s.journal_id)?.voucher_number??null,reversal:reversals.data?.find(j=>j.reversal_of===s.journal_id)?.voucher_number??null})),count:result.count});
 }catch(e){return reply({error:message(e)},400);}
}
export async function POST(request:Request){
 const csrf=assertCsrfRequest(request);if(!csrf.ok)return reply({error:csrf.reason},403);
 try{
  const {db,access}=await accountingContext();if(!access.manage)return reply({error:'Accounting management access required'},403);
  const body=await request.json();let result;
  if(body.operation==='post'){
   const v=requestSchema.parse(body.value);
   result=await db.rpc('tw_accounting_post_invoice',{p_invoice:v.invoice,p_company:v.company,p_version:v.version,p_date:v.date,p_receivable:v.receivable,p_revenue:v.revenue,p_vat:v.vat});
  }else if(body.operation==='withdraw'){
   const v=z.object({invoice:z.string().uuid(),version:z.number().int().positive()}).parse(body.value);
   result=await db.rpc('tw_accounting_withdraw_invoice',{p_invoice:v.invoice,p_version:v.version});
  }else return reply({error:'Unknown operation'},400);
  if(result.error)return reply({error:result.error.message},result.error.code==='42501'?403:result.error.code==='40001'?409:400);
  return reply({ok:true,id:result.data});
 }catch(e){return reply({error:message(e)},400);}
}
