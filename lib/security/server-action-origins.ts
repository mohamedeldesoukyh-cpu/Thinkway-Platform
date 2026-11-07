/**
 * Origins allowed to invoke Next.js Server Actions when Origin ≠ Host /
 * x-forwarded-host (common on Vercel Preview: unique URL vs branch alias).
 *
 * Same-origin requests always pass without this list. This list is the
 * allowlist for intentional cross-host cases (Preview aliases, proxies).
 */

function hostFromUrlOrHost(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).host;
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
  }
}

/**
 * Build-time Server Action origin allowlist for `next.config.ts`.
 * Includes explicitly configured Thinkway and Vercel deployment hosts.
 */
export function resolveServerActionAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const hosts = new Set<string>(env.NODE_ENV === "production" ? [] : ["localhost:3000", "127.0.0.1:3000"]);

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const host = hostFromUrlOrHost(appUrl);
    if (host) hosts.add(host);
  }

  for (const raw of env.CSRF_ALLOWED_ORIGINS?.split(",") ?? []) {
    const host = hostFromUrlOrHost(raw);
    if (host) hosts.add(host);
  }

  for (const key of [
    "NEXT_PUBLIC_DEVELOPMENT_APP_URL",
    "NEXT_PUBLIC_PRODUCTION_APP_URL",
  ] as const) {
    const host = hostFromUrlOrHost(env[key] ?? "");
    if (host) hosts.add(host);
  }

  // Vercel system hosts (unique deployment + git-branch alias).
  for (const key of ["VERCEL_URL", "VERCEL_BRANCH_URL"] as const) {
    const host = hostFromUrlOrHost(env[key] ? `https://${env[key]}` : "");
    if (host) hosts.add(host);
  }

  // Unrelated projects on the same hosting provider must never be trusted.

  return [...hosts];
}
