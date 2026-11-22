import {NextResponse} from 'next/server';
import {z} from 'zod';
import {accountingContext} from '@/features/accounting/setup-server';
import {isoDate} from '@/features/accounting/journal-validation';
import {assertCsrfRequest} from '@/lib/security/csrf';
const uuid=z.string().uuid(),signed=z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/),code=z.string().regex(/^\d{6}$/);
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const message=(e:unknown)=>e instanceof z.ZodError?e.issues[0]?.message:e instanceof Error?e.message:'Banking request failed';
export async function GET(request:Request){try{
 const {db}=await accountingContext();const q=new URL(request.url).searchParams,company=uuid.parse(q.get('company'));
 if(q.get('mode')==='report'){const r=await db.rpc('tw_accounting_bank_report',{p_company:company,p_bank:uuid.parse(q.get('bank')),p_statement:q.get('statement')?uuid.parse(q.get('statement')):null,p_to:isoDate.parse(q.get('to')),p_offset:z.coerce.number().int().min(0).max(100000).parse(q.get('page')??0)*100});if(r.error)throw new Error(r.error.message);return reply(r.data);}
 const [b,s]=await Promise.all([db.from('tw_accounting_banks').select('*').eq('company_id',company).order('name'),db.from('tw_accounting_bank_statements').select('id,bank_id,reference,from_date,to_date,opening,closing,status,version').eq('company_id',company).order('to_date',{ascending:false}).limit(1000)]);
 if(b.error||s.error)throw new Error(b.error?.message??s.error?.message);return reply({banks:b.data,statements:s.data});
 }catch(e){return reply({error:message(e)},400);}}
export async function POST(request:Request){const csrf=assertCsrfRequest(request);if(!csrf.ok)return reply({error:csrf.reason},403);try{
 const {db,access}=await accountingContext();if(!access.manage)return reply({error:'Accounting management access required'},403);
 const body=await request.json(),company=uuid.parse(body.company),action=z.enum(['bank-save','import','match','unmatch','close','reopen','void']).parse(body.action);let value;
 if(action==='bank-save')value=z.object({id:uuid,version:z.number().int().positive().nullable(),name:z.string().trim().min(2).max(120),account:code,auxiliary:z.union([uuid,z.literal('')]),currency:z.string().regex(/^[A-Z]{3}$/),reference:z.string().trim().max(120),active:z.boolean()}).parse(body.value);
 else if(action==='import')value=z.object({id:uuid,bank:uuid,reference:z.string().trim().min(1).max(120),from:isoDate,to:isoDate,opening:signed,closing:signed,rows:z.array(z.object({date:isoDate,reference:z.string().max(120),description:z.string().max(500),amount:signed})).min(1).max(2000)}).refine(v=>v.from<=v.to,'Check statement dates').parse(body.value);
 else value=z.object({id:uuid,version:z.number().int().positive(),reason:z.string().trim().min(3).max(500),match:uuid.optional(),rows:z.array(uuid).min(1).max(100).optional(),lines:z.array(z.object({journal:uuid,line:z.number().int().min(1).max(200)})).min(1).max(100).optional()}).parse(body.value);
 const r=await db.rpc('tw_accounting_bank_action',{p_company:company,p_action:action,p_value:value});if(r.error)return reply({error:r.error.message},r.error.code==='42501'?403:r.error.code==='40001'||r.error.code==='23505'?409:400);return reply({id:r.data});
 }catch(e){return reply({error:message(e)},400);}}
