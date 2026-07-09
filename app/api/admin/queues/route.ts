import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { getDiscoveryQueueReport } from "@/lib/observability/queue-report";
import { readWorkerHeartbeat } from "@/lib/observability/worker-heartbeat";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "operations.read");
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "Unauthorized" ? 401 : 403 }
    );
  }

  try {
    const [queues, worker] = await Promise.all([
      getDiscoveryQueueReport(),
      readWorkerHeartbeat(),
    ]);

    return NextResponse.json(
      {
        queues,
        worker: {
          alive: worker.alive,
          stale: worker.stale,
          ageMs: worker.ageMs,
          payload: worker.payload,
          error: worker.error,
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Queue report failed",
      },
      { status: 500 }
    );
  }
}
