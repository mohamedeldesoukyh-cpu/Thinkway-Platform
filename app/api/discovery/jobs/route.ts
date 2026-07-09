import { NextResponse } from "next/server";

import { getRecentDiscoveryJobs } from "@/features/discovery/queries";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "discovery.read");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 8), 25);

  try {
    const jobs = await getRecentDiscoveryJobs(limit);
    return NextResponse.json({ jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
