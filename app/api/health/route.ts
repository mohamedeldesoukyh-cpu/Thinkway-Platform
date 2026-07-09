import { NextResponse } from "next/server";

import { buildLivenessReport } from "@/lib/observability/health-checks";

export const dynamic = "force-dynamic";

/** Liveness probe — process is running. */
export async function GET() {
  const report = buildLivenessReport();
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
