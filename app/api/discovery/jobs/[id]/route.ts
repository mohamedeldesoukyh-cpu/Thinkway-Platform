import { NextResponse } from "next/server";

import { getDiscoveryJob } from "@/features/discovery/queries";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "discovery.read");
  if ("response" in auth) return auth.response;

  try {
    const job = await getDiscoveryJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
