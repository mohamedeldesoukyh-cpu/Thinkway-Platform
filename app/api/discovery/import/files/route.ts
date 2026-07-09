import { NextResponse } from "next/server";

import { getCreatorImportFiles } from "@/features/discovery-import/queries";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "discovery.write");
  if ("response" in auth) return auth.response;

  try {
    const files = await getCreatorImportFiles();
    return NextResponse.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load import history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
