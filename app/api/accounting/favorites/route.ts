import {NextResponse} from 'next/server';
import {z} from 'zod';
import {accountingContext} from '@/features/accounting/setup-server';
import {visibleAccountingNavigation} from '@/features/accounting/navigation';
import {assertCsrfRequest} from '@/lib/security/csrf';
const reply=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){try{
 const {db,user}=await accountingContext();
 const r=await db.from('tw_accounting_favorites').select('views').eq('profile_id',user.id).maybeSingle();
 if(r.error)throw Error(r.error.message);return reply(r.data?.views??['journals','receipts','payments','statements']);
}catch(e){return reply({error:e instanceof Error?e.message:'Could not load favorites'},400);}}
export async function POST(request:Request){
 const csrf=assertCsrfRequest(request);if(!csrf.ok)return reply({error:csrf.reason},403);
 try{const {db,user,access}=await accountingContext();const views=z.array(z.string()).max(12).parse(await request.json());
 const allowed=visibleAccountingNavigation(access).filter(n=>n.status==='Ready').map(n=>n.view);
 if(new Set(views).size!==views.length||views.some(v=>!allowed.includes(v as typeof allowed[number])))throw Error('Choose available Accounting screens only.');
 const r=await db.from('tw_accounting_favorites').upsert({profile_id:user.id,views,updated_at:new Date().toISOString()});
 if(r.error)throw Error(r.error.message);return reply({saved:true});
 }catch(e){return reply({error:e instanceof Error?e.message:'Could not save favorites'},400);}
}
