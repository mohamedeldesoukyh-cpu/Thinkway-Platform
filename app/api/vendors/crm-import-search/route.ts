import { NextResponse } from "next/server";

import { searchIdentitiesForCrmImport } from "@/features/vendors/queries";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "influencers.read");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchIdentitiesForCrmImport(q, 25);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed",
      },
      { status: 500 }
    );
  }
}
