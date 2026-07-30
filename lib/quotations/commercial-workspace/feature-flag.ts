/**
 * Quotation Commercial Workspace feature flag.
 *
 * Explicit true/1/on/yes → enabled
 * Explicit false/0/off/no → disabled
 * Unset → ON for Development / Preview; OFF for Production
 *
 * Env:
 *   QUOTATION_COMMERCIAL_WORKSPACE=true
 *   NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE=true
 */

function envFlag(raw: string | undefined): boolean | null {
  if (raw == null) return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true;
  }
  if (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }
  return null;
}

function isNonProductionSurface(): boolean {
  // Prefer public env so client components see the same default as the server.
  const thinkway = (
    process.env.NEXT_PUBLIC_THINKWAY_ENV ?? process.env.THINKWAY_ENV
  )
    ?.trim()
    .toLowerCase();
  if (thinkway === "production" || thinkway === "prod") return false;
  if (
    thinkway === "development" ||
    thinkway === "dev" ||
    thinkway === "preview" ||
    thinkway === "local"
  ) {
    return true;
  }

  const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (vercel === "production") return false;
  if (vercel === "preview" || vercel === "development") return true;

  return process.env.NODE_ENV !== "production";
}

/** When true, Commercial Summary opens as the editable Commercial Workspace. */
export function isQuotationCommercialWorkspaceEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE ??
    process.env.QUOTATION_COMMERCIAL_WORKSPACE;
  const explicit = envFlag(raw);
  if (explicit != null) return explicit;
  return isNonProductionSurface();
}
