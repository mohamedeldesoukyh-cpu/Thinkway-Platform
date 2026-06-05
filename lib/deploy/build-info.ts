import {
  CLEAN_LIFECYCLE_MANIFEST,
  hasLegacyAssignmentsEnv,
} from "@/lib/deploy/architecture-manifest";

/** Expected Supabase project ref (thinkway-dev) — migrations are applied here. */
export const EXPECTED_SUPABASE_PROJECT_REF = "hsxrewjcbvmbkqdlzjhs";

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
  const gitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    null;

  return {
    app: "thinkway-platform",
    environment: vercelEnv,
    gitSha,
    gitShaShort: gitSha ? gitSha.slice(0, 7) : null,
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
    expectedSupabaseProjectRef: EXPECTED_SUPABASE_PROJECT_REF,
    supabaseAligned:
      supabaseRef != null && supabaseRef === EXPECTED_SUPABASE_PROJECT_REF,
    builtAt: new Date().toISOString(),
    architecture: CLEAN_LIFECYCLE_MANIFEST,
    legacyAssignmentsEnvPresent: hasLegacyAssignmentsEnv(),
    productionReady:
      !hasLegacyAssignmentsEnv() &&
      supabaseRef != null &&
      supabaseRef === EXPECTED_SUPABASE_PROJECT_REF,
  };
}
