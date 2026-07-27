/**
 * Release / version metadata for UI display.
 * Values come from build-time env (see next.config.ts) — never hardcoded.
 */

export type ReleaseEnvironment = "development" | "preview" | "production";

export type ReleaseInfo = {
  appName: string;
  version: string;
  build: string;
  environment: ReleaseEnvironment;
  /** ISO timestamp when available */
  deploymentDate: string | null;
  deploymentDateLabel: string | null;
};

const APP_NAME = "Thinkway Platform";

export function resolveReleaseEnvironment(
  thinkwayEnv?: string | null,
  vercelEnv?: string | null,
): ReleaseEnvironment {
  const thinkway = (thinkwayEnv ?? "").trim().toLowerCase();
  const vercel = (vercelEnv ?? "").trim().toLowerCase();

  if (
    thinkway === "production" ||
    thinkway === "prod" ||
    vercel === "production"
  ) {
    return "production";
  }
  if (
    vercel === "preview" ||
    thinkway === "preview" ||
    thinkway === "staging"
  ) {
    return "preview";
  }
  return "development";
}

function formatDeploymentDate(iso: string | null): string | null {
  if (!iso?.trim()) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso.trim();
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(parsed);
  } catch {
    return iso.trim();
  }
}

/** Client- and server-safe release info from NEXT_PUBLIC_* build injection. */
export function getReleaseInfo(): ReleaseInfo {
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    process.env.npm_package_version?.trim() ||
    "0.0.0";

  const sha =
    process.env.NEXT_PUBLIC_GIT_SHA?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    "";

  const build = sha ? sha.slice(0, 7) : "local";

  const deploymentDateRaw =
    process.env.NEXT_PUBLIC_BUILD_TIMESTAMP?.trim() ||
    process.env.BUILD_TIMESTAMP?.trim() ||
    null;

  const environment = resolveReleaseEnvironment(
    process.env.NEXT_PUBLIC_THINKWAY_ENV || process.env.THINKWAY_ENV,
    process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV,
  );

  return {
    appName: APP_NAME,
    version,
    build,
    environment,
    deploymentDate: deploymentDateRaw,
    deploymentDateLabel: formatDeploymentDate(deploymentDateRaw),
  };
}
