import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountingContext } from '@/features/accounting/setup-server';
import { isoDate,journalSchema,journalActionSchema,reversalSchema,periodSchema } from '@/features/accounting/journal-validation';
import { assertCsrfRequest } from '@/lib/security/csrf';
const header='resume_status,workflow,id,company_id,entry_date,reference,memo,status,voucher_number,version,reversal_of,reversal_reason,source_invoice_id,source_payment_id,automatic_source,entry_kind,transaction_currency,exchange_rate,exchange_rate_date,unpost_reason,created_at,posted_at,control_locked,approval_state,control_reason';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const message=(e:unknown)=>e instanceof z.ZodError?e.issues[0]?.message:e instanceof Error?e.message:'Accounting request failed';
export async function GET(request:Request){
 try{
  const {db}=await accountingContext();const q=new URL(request.url).searchParams;
  const company=z.string().uuid().parse(q.get('company'));const mode=q.get('mode')??'journals';
  if(mode==='schedules'){
   const r=await db.from('tw_accounting_schedules').select('id,kind,name,next_date,end_date,interval_months,active,version,source_id,occurrence').eq('company_id',company).order('next_date').limit(500);if(r.error)throw new Error(r.error.message);
   const runs=await db.from('tw_accounting_schedule_runs').select('schedule_id,due_date,journal_id').eq('company_id',company).order('created_at',{ascending:false}).limit(100);if(runs.error)throw new Error(runs.error.message);return reply({schedules:r.data,runs:runs.data});
  }
  if(mode==='detail'){
   const id=z.string().uuid().parse(q.get('id'));
   const [j,l,r]=await Promise.all([
    db.from('tw_accounting_journals').select(header).eq('id',id).eq('company_id',company).single(),
    db.from('tw_accounting_journal_lines').select('client_id,vendor_id,entered_amount,entered_side,account_code,account_name,description,debit,credit,client_code,foreign_debit,foreign_credit,line_currency,line_rate,parent_account,auxiliary_id,auxiliary:tw_accounting_auxiliaries(number,name)').eq('journal_id',id).eq('company_id',company).order('line_number'),
    db.from('tw_accounting_journals').select(header).eq('reversal_of',id).eq('company_id',company).maybeSingle(),
   ]);
   if(j.error||l.error||r.error)return reply({error:'Journal could not be loaded'},404);
   return reply({journal:j.data,lines:(l.data??[]).map(x=>({clientId:x.client_id,vendorId:x.vendor_id,enteredAmount:x.entered_amount==null?null:String(x.entered_amount),enteredSide:x.entered_side,auxiliaryId:x.auxiliary_id,auxiliaryNumber:(x.auxiliary as unknown as {number:number}|null)?.number,auxiliaryName:(x.auxiliary as unknown as {name:string}|null)?.name,lineCurrency:x.line_currency,lineRate:x.line_rate==null?null:String(x.line_rate),parentAccount:x.parent_account,account:x.account_code,name:x.account_name,description:x.description,debit:String(x.debit),credit:String(x.credit),foreignDebit:x.foreign_debit==null?null:String(x.foreign_debit),foreignCredit:x.foreign_credit==null?null:String(x.foreign_credit)})),reversal:r.data});
  }
  if(mode==='periods'){
   const years=await db.from('tw_accounting_years').select('id').eq('company_id',company);if(years.error)throw new Error(years.error.message);
   if(!years.data?.length)return reply({periods:[]});
   const p=await db.from('tw_accounting_periods').select('id,year_id,period_number,start_date,end_date,is_closed,lock_reason,version').in('year_id',years.data.map(y=>y.id)).order('start_date');if(p.error)throw new Error(p.error.message);return reply({periods:p.data});
  }
  const from=isoDate.parse(q.get('from')),to=isoDate.parse(q.get('to'));if(from>to)throw new Error('Start date must not follow end date');
  const page=z.coerce.number().int().min(0).max(100000).parse(q.get('page')??0);
  if(mode==='trial') {const r=await db.rpc('tw_accounting_trial_balance',{p_company:company,p_from:from,p_to:to});if(r.error)throw new Error(r.error.message);return reply({rows:r.data});}
  if(mode==='ledger') {const account=z.string().regex(/^\d{6}$/).parse(q.get('account'));const r=await db.rpc('tw_accounting_ledger',{p_company:company,p_account:account,p_from:from,p_to:to,p_offset:page*100});if(r.error)throw new Error(r.error.message);return reply(r.data);}
  if(mode!=='journals')return reply({error:'Unknown view'},400);
  let query=db.from('tw_accounting_journals').select(header,{count:'exact'}).eq('company_id',company).gte('entry_date',from).lte('entry_date',to).order('created_at',{ascending:false}).order('voucher_number',{ascending:false,nullsFirst:false}).order('id').range(page*50,page*50+49);
  if(q.get('workflow'))query=query.eq('workflow',z.enum(['transfer','opening']).parse(q.get('workflow')));
  if(q.get('kind')==='expense')query=query.eq('entry_kind','expense');const status=q.get('status');if(status&&status!=='all')query=query.eq('status',z.enum(['draft','posted','cancelled','pending']).parse(status));
  const search=z.string().trim().max(120).parse(q.get('search')??'');if(search)query=query.ilike('voucher_number','%'+search.replaceAll('%','\\%').replaceAll('_','\\_')+'%');
  const r=await query;if(r.error)throw new Error(r.error.message);return reply({journals:r.data,count:r.count});
 }catch(e){return reply({error:message(e)},400);}
}
export async function POST(request:Request){
 const csrf=assertCsrfRequest(request);if(!csrf.ok)return reply({error:csrf.reason},403);
 try{
  const {db,access}=await accountingContext();if(!access.manage)return reply({error:'Accounting management access required'},403);
  const body=await request.json();let r;
  if(body.operation==='schedule') {const v=z.object({company:z.string().uuid(),action:z.enum(['create','toggle','run']),id:z.string().uuid(),version:z.number().int().positive().optional(),source:z.string().uuid().optional(),sourceVersion:z.number().int().positive().optional(),kind:z.enum(['recurring','reversal']).optional(),name:z.string().trim().min(3).max(120).optional(),date:isoDate.optional(),end:z.union([isoDate,z.literal('')]).optional(),months:z.number().int().min(1).max(12).optional()}).parse(body.value);if(v.action==='create'&&(!v.source||!v.sourceVersion||!v.kind||!v.name||!v.date))throw new Error('Complete the schedule');if(v.action!=='create'&&!v.version)throw new Error('Refresh the schedule');if(v.action==='run'&&!v.date)throw new Error('Select the due date');r=await db.rpc('tw_accounting_schedule_action',{p_company:v.company,p_action:v.action,p_value:v});}
  else if(body.operation==='save') {const v=journalSchema.parse(body.value);r=await db.rpc('tw_accounting_save_signed_workflow',{p_value:v});}
  else if(body.operation==='mark'){const v=z.object({company:z.string().uuid(),id:z.string().uuid(),version:z.number().int().positive(),mark:z.enum(['pending','cancelled','clear']),reason:z.string().trim().min(3).max(500)}).parse(body.value);r=await db.rpc('tw_accounting_journal_mark',{p_company:v.company,p_id:v.id,p_version:v.version,p_mark:v.mark,p_reason:v.reason});}
  else if(body.operation==='post'||body.operation==='cancel'){const v=journalActionSchema.parse(body.value);r=await db.rpc(body.operation==='post'?'tw_accounting_post_journal':'tw_accounting_cancel_journal',{p_id:v.id,p_company:v.company,p_version:v.version});}
  else if(body.operation==='reverse'){const v=reversalSchema.parse(body.value);r=await db.rpc('tw_accounting_reverse_journal',{p_id:v.id,p_company:v.company,p_reversal:v.reversal,p_date:v.date,p_reason:v.reason});}
  else if(body.operation==='period'){const v=periodSchema.parse(body.value);r=await db.rpc('tw_accounting_set_period',{p_company:v.company,p_period:v.period,p_closed:v.closed,p_reason:v.reason,p_version:v.version});}
  else return reply({error:'Unknown operation'},400);
  if(r.error)return reply({error:r.error.message},r.error.code==='42501'?403:r.error.code==='40001'||r.error.code==='23505'?409:400);
  return reply({ok:true,id:r.data});
 }catch(e){return reply({error:message(e)},400);}
}
