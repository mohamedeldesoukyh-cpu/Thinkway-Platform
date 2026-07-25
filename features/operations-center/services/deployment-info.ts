import { getBuildInfo } from "@/lib/deploy/build-info";

import type { DeploymentInformation } from "../types";

export function collectDeploymentInformation(): DeploymentInformation {
  const build = getBuildInfo();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? null;

  return {
    application: {
      environment:
        build.environment === "production"
          ? "Production"
          : build.environment === "preview"
            ? "Preview"
            : build.environment === "development"
              ? "Development"
              : build.environment,
      gitCommitSha: build.gitSha,
      gitCommitShaShort: build.gitShaShort,
      gitBranch: build.gitBranch,
      buildTimestamp: build.builtAt,
      buildNumber: build.buildNumber,
      deployedBy: build.deployedBy,
    },
    vercel: {
      deploymentId: build.deploymentId,
      deploymentUrl: build.deploymentUrl,
      deploymentStatus: process.env.VERCEL_ENV
        ? `Active (${process.env.VERCEL_ENV})`
        : "Not on Vercel / metadata unavailable",
      vercelEnv: process.env.VERCEL_ENV?.trim() ?? null,
    },
    supabase: {
      projectRef: build.supabaseProjectRef,
      projectUrl,
      region: build.supabaseRegion,
      postgresVersion:
        process.env.SUPABASE_POSTGRES_VERSION?.trim() ?? null,
      expectedProjectRef: build.expectedSupabaseProjectRef,
      alignedWithExpected: build.supabaseAligned,
    },
  };
}
