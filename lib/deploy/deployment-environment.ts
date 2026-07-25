import {
  DEVELOPMENT_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "@/lib/deploy/build-info";

/**
 * Hosted deployment surface for Thinkway Platform.
 * Distinct from local machines (`local`) — never switches databases in-process;
 * the environment switch navigates to a different deployment host.
 */
export type DeploymentSurface = "local" | "development" | "production";

export const DEFAULT_DEVELOPMENT_APP_URL = "https://dev.thinkwaymedia.com";
export const DEFAULT_PRODUCTION_APP_URL = "https://app.thinkwaymedia.com";

export function getDevelopmentAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DEVELOPMENT_APP_URL?.trim() ||
    DEFAULT_DEVELOPMENT_APP_URL
  );
}

export function getProductionAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PRODUCTION_APP_URL?.trim() ||
    DEFAULT_PRODUCTION_APP_URL
  );
}

function hostMatches(url: string, host: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Resolve the deployment surface for the running app.
 * Prefer explicit THINKWAY_ENV / NEXT_PUBLIC_THINKWAY_ENV, then hostname, then Vercel.
 */
export function getDeploymentSurface(options?: {
  host?: string | null;
}): DeploymentSurface {
  const explicit = (
    process.env.NEXT_PUBLIC_THINKWAY_ENV?.trim() ||
    process.env.THINKWAY_ENV?.trim() ||
    ""
  ).toLowerCase();

  if (explicit === "production" || explicit === "prod") return "production";
  if (
    explicit === "development" ||
    explicit === "dev" ||
    explicit === "staging"
  ) {
    return "development";
  }
  if (explicit === "local") return "local";

  const host =
    options?.host?.toLowerCase() ||
    process.env.VERCEL_URL?.trim()?.toLowerCase() ||
    null;

  if (host) {
    const bare = host.replace(/:\d+$/, "");
    if (
      hostMatches(getDevelopmentAppUrl(), bare) ||
      bare.startsWith("dev.thinkwaymedia.com")
    ) {
      return "development";
    }
    if (
      hostMatches(getProductionAppUrl(), bare) ||
      bare.startsWith("app.thinkwaymedia.com")
    ) {
      return "production";
    }
  }

  const vercel = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "development";

  return "local";
}

export function getDeploymentSurfaceLabel(
  surface: DeploymentSurface = getDeploymentSurface(),
): string {
  switch (surface) {
    case "production":
      return "Production";
    case "development":
      return "Development";
    default:
      return "Local";
  }
}

export function getExpectedSupabaseRefForSurface(
  surface: DeploymentSurface = getDeploymentSurface(),
): string {
  return surface === "production"
    ? PRODUCTION_SUPABASE_PROJECT_REF
    : DEVELOPMENT_SUPABASE_PROJECT_REF;
}

/** URL of the other hosted environment (for the environment switch). */
export function getAlternateDeploymentUrl(
  surface: DeploymentSurface = getDeploymentSurface(),
): string | null {
  if (surface === "development") return getProductionAppUrl();
  if (surface === "production") return getDevelopmentAppUrl();
  return null;
}

export function buildEnvironmentSwitchHref(
  targetSurface: "development" | "production",
  currentPathAndSearch = "/",
): string {
  const base =
    targetSurface === "production"
      ? getProductionAppUrl()
      : getDevelopmentAppUrl();
  const path =
    currentPathAndSearch.startsWith("/")
      ? currentPathAndSearch
      : `/${currentPathAndSearch}`;
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Public config injected into the client banner (no secrets). */
export function getPublicDeploymentConfig(host?: string | null) {
  const surface = getDeploymentSurface({ host });
  return {
    surface,
    label: getDeploymentSurfaceLabel(surface),
    developmentAppUrl: getDevelopmentAppUrl(),
    productionAppUrl: getProductionAppUrl(),
    alternateAppUrl: getAlternateDeploymentUrl(surface),
    expectedSupabaseProjectRef: getExpectedSupabaseRefForSurface(surface),
  };
}
