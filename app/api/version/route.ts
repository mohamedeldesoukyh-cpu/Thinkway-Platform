import { NextResponse } from "next/server";

import { getBuildInfo } from "@/lib/deploy/build-info";
import { getReleaseInfo } from "@/lib/release/release-info";

export const dynamic = "force-dynamic";

/** Version and deployment metadata for ops probes. */
export async function GET() {
  const build = getBuildInfo();
  const release = getReleaseInfo();

  return NextResponse.json(
    {
      app: build.app,
      appName: release.appName,
      version: release.version,
      build: release.build,
      environment: release.environment,
      gitSha: build.gitSha ?? process.env.NEXT_PUBLIC_GIT_SHA ?? null,
      gitShaShort: release.build === "local" ? null : release.build,
      builtAt: release.deploymentDate ?? build.builtAt,
      deploymentDate: release.deploymentDateLabel,
      supabaseProjectRef: build.supabaseProjectRef,
      supabaseAligned: build.supabaseAligned,
      productionReady: build.productionReady,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
