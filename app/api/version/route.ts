import { NextResponse } from "next/server";

import { getBuildInfo } from "@/lib/deploy/build-info";
import { getThinkwayEnvironment } from "@/lib/observability/environment";

export const dynamic = "force-dynamic";

/** Version and deployment metadata for ops probes. */
export async function GET() {
  const build = getBuildInfo();

  return NextResponse.json(
    {
      app: build.app,
      version: process.env.npm_package_version ?? "0.1.0",
      environment: getThinkwayEnvironment(),
      gitSha: build.gitSha,
      gitShaShort: build.gitShaShort,
      builtAt: build.builtAt,
      supabaseProjectRef: build.supabaseProjectRef,
      supabaseAligned: build.supabaseAligned,
      productionReady: build.productionReady,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
