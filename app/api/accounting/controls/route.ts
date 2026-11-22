import {NextResponse} from 'next/server';
import {z} from 'zod';
import {accountingContext} from '@/features/accounting/setup-server';
import {controlActionSchema,controlFiltersSchema,approvalPolicySchema} from '@/features/accounting/control-validation';
import {assertCsrfRequest} from '@/lib/security/csrf';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const failure=(error:unknown)=>reply({error:error instanceof z.ZodError?error.issues[0]?.message:error instanceof Error?error.message:'Accounting request failed'},400);
export async function GET(request:Request){
 try{
  const {db,user}=await accountingContext();const q=new URL(request.url).searchParams;
  if(q.get('mode')==='history'){
   const company=z.string().uuid().parse(q.get('company')),journal=z.string().uuid().nullable().parse(q.get('journal'));
   const page=z.coerce.number().int().min(0).max(20000).parse(q.get('page')??0);
   const result=await db.rpc('tw_accounting_control_history',{p_company:company,p_journal:journal,p_offset:page*50});
   if(result.error)return reply({error:result.error.message},result.error.code==='42501'?403:400);return reply(result.data);
  }
  const v=controlFiltersSchema.parse(Object.fromEntries(q));
  let query=db.from('tw_accounting_journals').select('resume_status,id,company_id,entry_date,memo,reference,status,voucher_number,version,created_by,control_editor,control_locked,control_reason,approval_state,approval_by,source_invoice_id,source_payment_id,automatic_source,reversal_of',{count:'exact'})
   .eq('company_id',v.company).gte('entry_date',v.from).lte('entry_date',v.to).order('entry_date',{ascending:false}).order('id').range(v.page*50,v.page*50+49);
  if(v.approval!=='all')query=query.eq('approval_state',v.approval);
  if(v.locked!=='all')query=query.eq('control_locked',v.locked==='yes');
  if(q.get('mode')==='approvals')query=query.or('status.eq.draft,resume_status.not.is.null').is('source_invoice_id',null).is('source_payment_id',null).is('automatic_source',null).is('reversal_of',null);
  const result=await query;if(result.error)throw new Error(result.error.message);
  return reply({rows:result.data,count:result.count,actor:user.id});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 const csrf=assertCsrfRequest(request);if(!csrf.ok)return reply({error:csrf.reason},403);
 try{
  const {db,access}=await accountingContext();if(!access.manage)return reply({error:'Accounting management access required'},403);
  const body=await request.json();let result;
  if(body.operation==='policy'){
   if(!access.admin)return reply({error:'Administrator access required'},403);
   const v=approvalPolicySchema.parse(body.value);result=await db.rpc('tw_accounting_approval_policy',{p_company:v.company,p_required:v.required,p_version:v.version,p_reason:v.reason});
  }else if(body.operation==='action'){
   const v=controlActionSchema.parse(body.value);result=await db.rpc('tw_accounting_control_action',{p_company:v.company,p_action:v.action,p_entries:v.entries,p_reason:v.reason});
  }else return reply({error:'Unknown operation'},400);
  if(result.error)return reply({error:result.error.message},result.error.code==='42501'?403:result.error.code==='40001'?409:400);
  return reply({ok:true,result:result.data});
 }catch(error){return failure(error);}
}
