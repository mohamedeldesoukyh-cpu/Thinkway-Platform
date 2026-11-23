import {NextResponse} from 'next/server';
import {z} from 'zod';
import {accountingContext} from '@/features/accounting/setup-server';
import {isoDate} from '@/features/accounting/journal-validation';
import {assertCsrfRequest} from '@/lib/security/csrf';
const uuid=z.string().uuid(),reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const {db}=await accountingContext(),q=new URL(request.url).searchParams,company=uuid.parse(q.get('company'));
 if(q.get('mode')==='history'){
  const r=await db.from('tw_accounting_monthly_accruals').select('id,month,posting_date,journal_id,reversal_id,journal:tw_accounting_journals!tw_accounting_monthly_accruals_journal_id_fkey(voucher_number)').eq('company_id',company).order('created_at',{ascending:false}).limit(100);if(r.error)throw Error(r.error.message);return reply(r.data);
 }
 const r=q.get('mode')==='reverse'?await db.rpc('tw_accounting_monthly_reversal_plan',{p_company:company,p_run:uuid.parse(q.get('run')),p_date:isoDate.parse(q.get('date'))}):await db.rpc('tw_accounting_monthly_plan',{p_company:company,p_month:isoDate.parse(q.get('month')),p_date:isoDate.parse(q.get('date'))});if(r.error)throw Error(r.error.message);return reply(r.data);
}catch(e){return reply({error:e instanceof Error?e.message:'Accrual review failed'},400);}}
export async function POST(request:Request){const csrf=assertCsrfRequest(request);if(!csrf.ok)return reply({error:csrf.reason},403);try{
 const {db,access}=await accountingContext();if(!access.manage)return reply({error:'Accounting management required'},403);
 const v=z.object({company:uuid,run:uuid,action:z.enum(['post','reverse']),month:isoDate,date:isoDate,token:z.string().regex(/^[a-f0-9]{32}$/),reason:z.string().trim().max(500).default('')}).parse(await request.json());
 if(v.action==='reverse'&&v.reason.length<3)return reply({error:'Enter a reversal reason'},400);
 const r=v.action==='post'?await db.rpc('tw_accounting_monthly_post',{p_company:v.company,p_run:v.run,p_month:v.month,p_date:v.date,p_token:v.token}):await db.rpc('tw_accounting_monthly_reverse',{p_company:v.company,p_run:v.run,p_date:v.date,p_token:v.token,p_reason:v.reason});if(r.error)return reply({error:r.error.message},r.error.code==='40001'?409:400);return reply({journal:r.data});
}catch(e){return reply({error:e instanceof Error?e.message:'Accrual posting failed'},400);}}
