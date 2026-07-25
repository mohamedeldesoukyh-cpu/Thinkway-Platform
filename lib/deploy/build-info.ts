import {
  CLEAN_LIFECYCLE_MANIFEST,
  hasLegacyAssignmentsEnv,
} from "@/lib/deploy/architecture-manifest";

/** Development Supabase project (thinkway-dev). */
export const DEVELOPMENT_SUPABASE_PROJECT_REF = "hsxrewjcbvmbkqdlzjhs";

/** Production Supabase project (thinkway-production). */
export const PRODUCTION_SUPABASE_PROJECT_REF = "ienowhwfyxoqtzbgltno";

/**
 * @deprecated Prefer getExpectedSupabaseProjectRef() — production now uses a dedicated project.
 * Kept for older call sites that import the constant name.
 */
export const EXPECTED_SUPABASE_PROJECT_REF = PRODUCTION_SUPABASE_PROJECT_REF;

export function getExpectedSupabaseProjectRef(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
): string {
  const override = process.env.EXPECTED_SUPABASE_PROJECT_REF?.trim();
  if (override) return override;
  if (vercelEnv === "production") return PRODUCTION_SUPABASE_PROJECT_REF;
  return DEVELOPMENT_SUPABASE_PROJECT_REF;
}

export function parseSupabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getBuildInfo() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseRef = parseSupabaseProjectRef(supabaseUrl);
  const vercelEnv = process.env.VERCEL_ENV ?? "local";
  const expectedRef = getExpectedSupabaseProjectRef(vercelEnv);
  const gitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    null;

  return {
    app: "thinkway-platform",
    environment: vercelEnv,
    gitSha,
    gitShaShort: gitSha ? gitSha.slice(0, 7) : null,
    gitBranch:
      process.env.VERCEL_GIT_COMMIT_REF ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ??
      null,
    buildNumber:
      process.env.VERCEL_DEPLOYMENT_ID ??
      process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ??
      null,
    deployedBy:
      process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_NAME ??
      null,
    deploymentId:
      process.env.VERCEL_DEPLOYMENT_ID ??
      process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ??
      null,
    deploymentUrl: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
    supabaseProjectRef: supabaseRef,
    supabaseUrlHost: supabaseUrl
      ? (() => {
          try {
            return new URL(supabaseUrl).host;
          } catch {
            return null;
          }
        })()
      : null,
    supabaseRegion:
      process.env.SUPABASE_REGION?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_REGION?.trim() ||
      null,
    expectedSupabaseProjectRef: expectedRef,
    supabaseAligned:
      supabaseRef != null && supabaseRef === expectedRef,
    builtAt:
      process.env.BUILD_TIMESTAMP?.trim() ||
      process.env.NEXT_PUBLIC_BUILD_TIMESTAMP?.trim() ||
      new Date().toISOString(),
    architecture: CLEAN_LIFECYCLE_MANIFEST,
    legacyAssignmentsEnvPresent: hasLegacyAssignmentsEnv(),
    productionReady:
      !hasLegacyAssignmentsEnv() &&
      supabaseRef != null &&
      supabaseRef === expectedRef,
  };
}
