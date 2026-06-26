import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/permissions";
import {
  buildCampaignPerformanceHealth,
  healthHttpStatus,
} from "@/lib/performance/campaign-performance-health";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function authorizeService(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function authorizeAdmin(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "operations.read");
  if ("error" in auth) {
    return { ok: false, status: auth.error === "Unauthorized" ? 401 : 403, error: auth.error };
  }
  return { ok: true };
}

export async function GET(request: Request) {
  const serviceAuth = authorizeService(request);
  if (!serviceAuth) {
    const auth = await authorizeAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  try {
    const supabase = createSupabaseAdminClient();
    const health = await buildCampaignPerformanceHealth(supabase);

    return NextResponse.json(health, {
      status: healthHttpStatus(health.status),
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Health check failed.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
