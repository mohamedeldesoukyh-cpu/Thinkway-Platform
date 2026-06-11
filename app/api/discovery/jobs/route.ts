import { NextResponse } from "next/server";

import { getRecentDiscoveryJobs } from "@/features/discovery/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
