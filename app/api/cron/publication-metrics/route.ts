import { NextResponse } from "next/server";

import { collectScheduledMetricsRefresh } from "@/lib/performance/metrics-collector";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const result = await collectScheduledMetricsRefresh(supabase, { limit: 50 });

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      queued: result.outcomes.length === 0 && result.processed > 0,
      completed: result.outcomes.filter((o) => o.status === "completed").length,
      partial: result.outcomes.filter((o) => o.status === "partial").length,
      manual_required: result.outcomes.filter((o) => o.status === "manual_required").length,
      failed: result.outcomes.filter((o) => o.status === "failed").length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed." },
      { status: 500 }
    );
  }
}
