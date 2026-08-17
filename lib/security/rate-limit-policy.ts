import type { RateLimitCategory } from "@/lib/security/rate-limit";

/**
 * Map request path (+ server-action hint) to a rate-limit category.
 */
export function resolveRateLimitCategory(input: {
  pathname: string;
  method: string;
  isServerAction?: boolean;
}): RateLimitCategory {
  const pathname = input.pathname.toLowerCase();
  const method = input.method.toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);

  // Tight auth budget applies only to mutating sign-in / MFA / invite posts.
  // GET navigations (login page, MFA challenge after redirect, RSC prefetches)
  // must NOT share that 5/min bucket — otherwise post-login MFA renders as a
  // JSON 429 and the browser shows "This page couldn't load".
  const authSurface =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/io-approval/") ||
    pathname.startsWith("/review/");
  if (authSurface && (mutating || input.isServerAction)) {
    return "auth";
  }

  // Tight AI budget applies only to mutating `/api/ai/*` calls (chat / generation).
  // GET conversation loads and `/ai` page navigations must NOT share that 10/min
  // bucket — Studio/Copilot chatter was exhausting it and blocking regenerates.
  if (pathname.startsWith("/api/ai/") && mutating) {
    return "ai";
  }

  if (
    pathname.includes("/documents") ||
    pathname.includes("/discovery-import") ||
    pathname.includes("/import") ||
    (pathname.startsWith("/api/clients/") && pathname.endsWith("/documents"))
  ) {
    return "upload";
  }

  if (
    pathname.startsWith("/api/discovery/") ||
    pathname.startsWith("/discovery")
  ) {
    return "discovery";
  }

  if (
    pathname.startsWith("/settings") &&
    (mutating || input.isServerAction)
  ) {
    return "invite";
  }

  if (
    pathname.includes("/export") ||
    pathname.includes("/document") ||
    pathname.endsWith("/document") ||
    pathname.includes("/performance/document")
  ) {
    return "export";
  }

  if (
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/ready") ||
    pathname.startsWith("/api/version") ||
    pathname.startsWith("/api/build-info")
  ) {
    return "public";
  }

  return "default";
}

export function rateLimitIdentity(input: {
  ip: string | null;
  userId?: string | null;
  category: RateLimitCategory;
}): string {
  if (input.userId && input.category !== "auth" && input.category !== "public") {
    return `user:${input.userId}`;
  }
  return `ip:${input.ip?.trim() || "unknown"}`;
}
