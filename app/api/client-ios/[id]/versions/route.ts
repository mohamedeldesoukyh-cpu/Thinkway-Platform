import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchClientIoVersionHistory } from "@/lib/io/client-io-query";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "client_ios.read");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const { data, error } = await supabase.from("client_ios").select("id, root_client_io_id").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load IO versions" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Client IO not found" }, { status: 404 });
  try {
    return NextResponse.json(await fetchClientIoVersionHistory(supabase, data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load IO versions" }, { status: 500 });
  }
}
