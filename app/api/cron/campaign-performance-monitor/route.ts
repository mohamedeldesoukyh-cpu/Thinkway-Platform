import { NextResponse } from "next/server";

import { captureException } from "@/lib/observability/error-reporter";
import { runCampaignPerformanceAudit } from "@/lib/performance/campaign-performance-audit";
import {
  buildCampaignPerformanceAlerts,
  dispatchCampaignPerformanceAlerts,
} from "@/lib/performance/campaign-performance-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

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
    const audit = await runCampaignPerformanceAudit(supabase);
    const monitor = buildCampaignPerformanceAlerts(audit);
    const { webhookSent } = await dispatchCampaignPerformanceAlerts(monitor);

    return NextResponse.json({
      ok: monitor.ok,
      webhookSent,
      alertCount: monitor.alerts.length,
      ...monitor.summary,
      alerts: monitor.alerts,
    });
  } catch (error) {
    captureException(error, {
      route: "/api/cron/campaign-performance-monitor",
      service: "cron",
      status: 500,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Monitor cron failed." },
      { status: 500 }
    );
  }
}
