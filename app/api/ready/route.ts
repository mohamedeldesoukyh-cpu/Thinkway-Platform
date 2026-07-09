import { NextResponse } from "next/server";

import {
  buildReadinessReport,
  readinessHttpStatus,
} from "@/lib/observability/health-checks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Readiness probe — DB, Redis, storage, worker heartbeat, queue summary. */
export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const report = await buildReadinessReport(supabase);

    return NextResponse.json(report, {
      status: readinessHttpStatus(report.status),
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Readiness check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
