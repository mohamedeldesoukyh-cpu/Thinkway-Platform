import { NextResponse } from "next/server";
import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";
import { loadModuleAccess } from "@/lib/auth/module-access";
import { assertCsrfRequest } from "@/lib/security/csrf";
export async function GET() {
  const {user} = await getRequestAuth();
  if (!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  try { return NextResponse.json(await loadModuleAccess(await createSupabaseServerClient()),{headers:{"Cache-Control":"private, no-store"}}); }
  catch { return NextResponse.json({error:"Could not verify modules"},{status:503}); }
}
export async function POST(request:Request) {
  const csrf=assertCsrfRequest(request);
  if(!csrf.ok)return NextResponse.json({error:csrf.reason},{status:403});
  const db=await createSupabaseServerClient();
  const {error}=await db.auth.signOut();
  return NextResponse.json(error?{error:'Sign out failed'}:{ok:true},{status:error?500:200});
}
