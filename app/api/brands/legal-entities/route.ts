import { NextResponse } from "next/server";
import { listBrandLegalEntities } from "@/features/brands/actions";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "clients.read");
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await listBrandLegalEntities(), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "Could not load legal entities." }, { status: 500 });
  }
}
