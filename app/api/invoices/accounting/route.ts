import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient,getRequestAuth } from '@/lib/supabase/server';
import { assertCsrfRequest } from '@/lib/security/csrf';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const message=(e:unknown)=>e instanceof z.ZodError?e.issues[0]?.message:e instanceof Error?e.message:'Accounting request failed';
async function context(){if(!(await getRequestAuth()).user)throw new Error('Please sign in');return await createSupabaseServerClient() as SupabaseClient;}
export async function GET(request:Request){try{
 const db=await context();const id=z.string().uuid().parse(new URL(request.url).searchParams.get('invoice'));
 const r=await db.rpc('tw_accounting_media_invoice',{p_invoice:id});if(r.error)return reply({error:r.error.message},r.error.code==='42501'?403:400);return reply(r.data);
}catch(e){return reply({error:message(e)},400);}}
export async function POST(request:Request){
 const csrf=assertCsrfRequest(request);if(!csrf.ok)return reply({error:csrf.reason},403);
 try{
  const db=await context();const body=await request.json();let r;
  if(body.operation==='submit'){
   const v=z.object({invoice:z.string().uuid(),company:z.string().uuid()}).parse(body.value);
   r=await db.rpc('tw_accounting_submit_invoice',{p_invoice:v.invoice,p_company:v.company});
  }else if(body.operation==='withdraw'){
   const v=z.object({invoice:z.string().uuid(),version:z.number().int().positive()}).parse(body.value);
   r=await db.rpc('tw_accounting_withdraw_invoice',{p_invoice:v.invoice,p_version:v.version});
  }else return reply({error:'Unknown operation'},400);
  if(r.error)return reply({error:r.error.message},r.error.code==='42501'?403:r.error.code==='40001'?409:400);return reply({ok:true});
 }catch(e){return reply({error:message(e)},400);}
}
