import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountingContext } from '@/features/accounting/setup-server';
import { isoDate } from '@/features/accounting/journal-validation';
import { assertCsrfRequest } from '@/lib/security/csrf';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=z.string().uuid(),amount=z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),account=z.string().regex(/^\d{6}$/);
const quote=z.object({currency:z.string().length(3),base:z.string().length(3),rate:z.string().max(40),date:isoDate,amount:z.string().max(40),cash:z.string().max(40),receivable:z.string().max(40),gain:z.string().max(40),account,invoiceVersion:z.number().int(),settled:z.string().max(40),settledBase:z.string().max(40),minPostingDate:isoDate});
const posting=z.object({company:uuid,postDate:isoDate,cash:account,gain:account,loss:account,expected:quote});
const message=(e:unknown)=>e instanceof z.ZodError?e.issues[0]?.message:e instanceof Error?e.message:'Receipt request failed';
export async function GET(request:Request){try{
 const {db}=await accountingContext();const q=new URL(request.url).searchParams;const company=uuid.parse(q.get('company'));
 const r=q.get('mode')==='quote'?await db.rpc('tw_accounting_receipt_quote',{p_invoice:uuid.parse(q.get('invoice')),p_company:company,p_amount:amount.parse(q.get('amount')),p_date:isoDate.parse(q.get('date'))}):await db.rpc('tw_accounting_receipts_list',{p_company:company,p_search:z.string().max(120).parse(q.get('search')??''),p_page:z.coerce.number().int().min(0).max(100000).parse(q.get('page')??0)});
 if(r.error)throw new Error(r.error.message);return reply(r.data);
}catch(e){return reply({error:message(e)},400);}}
export async function POST(request:Request){
 const csrf=assertCsrfRequest(request);if(!csrf.ok)return reply({error:csrf.reason},403);
 try{const {db,access}=await accountingContext();if(!access.manage)return reply({error:'Accounting management access required'},403);
 const body=await request.json();let r;
 if(body.operation==='reverse'){const v=z.object({company:uuid,payment:uuid,date:isoDate,reason:z.string().trim().min(3).max(500)}).parse(body.value);r=await db.rpc('tw_accounting_reverse_receipt',{p_company:v.company,p_payment:v.payment,p_date:v.date,p_reason:v.reason});}
 else if(body.operation==='post'){const v=posting.extend({payment:uuid,revision:z.number().int().min(0)}).parse(body.value);r=await db.rpc('tw_accounting_post_receipt',{p_company:v.company,p_payment:v.payment,p_revision:v.revision,p_post_date:v.postDate,p_cash:v.cash,p_gain:v.gain,p_loss:v.loss,p_expected:v.expected});}
 else if(body.operation==='record'){const v=posting.extend({request:uuid,invoice:uuid,amount,date:isoDate,method:z.enum(['bank_transfer','credit_card','debit_card','paypal','wire','check','other']),reference:z.string().max(120),notes:z.string().max(2000)}).parse(body.value);r=await db.rpc('tw_accounting_record_receipt',{p_request:v.request,p_invoice:v.invoice,p_company:v.company,p_amount:v.amount,p_date:v.date,p_method:v.method,p_reference:v.reference,p_notes:v.notes,p_post_date:v.postDate,p_cash:v.cash,p_gain:v.gain,p_loss:v.loss,p_expected:v.expected});}
 else return reply({error:'Unknown receipt operation'},400);
 if(r.error)return reply({error:r.error.message},r.error.code==='42501'?403:r.error.code==='40001'?409:400);return reply({ok:true,id:r.data});
 }catch(e){return reply({error:message(e)},400);}
}
