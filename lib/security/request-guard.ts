import { type NextRequest, NextResponse } from "next/server";

import { getClientIp } from "@/lib/auth/api-auth";
import { isApiPath } from "@/lib/auth/routes";
import { incrementSecurityMetric } from "@/features/operations-center/metrics/security-metrics-store";
import { assertCsrfRequest } from "@/lib/security/csrf";
import {
  consumeRateLimit,
  rateLimitExceededBody,
} from "@/lib/security/rate-limit";
import {
  rateLimitIdentity,
  resolveRateLimitCategory,
} from "@/lib/security/rate-limit-policy";
import { applySecurityHeaders } from "@/lib/security/security-headers";

function isServerActionRequest(request: NextRequest): boolean {
  if (request.headers.has("next-action") || request.headers.has("Next-Action")) {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return request.method === "POST" && accept.includes("text/x-component");
}

function withGuardHeaders(
  response: NextResponse,
  pathname: string,
  rate?: { limit: number; remaining: number; resetAt: number }
): NextResponse {
  applySecurityHeaders(response.headers, { api: isApiPath(pathname) });
  if (rate) {
    response.headers.set("X-RateLimit-Limit", String(rate.limit));
    response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(rate.resetAt / 1000)));
  }
  return response;
}

/**
 * Apply rate limiting + CSRF before session middleware.
 * Returns a response when the request must be blocked; otherwise null.
 */
export function preAuthRequestGuard(
  request: NextRequest
): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const serverAction = isServerActionRequest(request);
  const category = resolveRateLimitCategory({
    pathname,
    method: request.method,
    isServerAction: serverAction,
  });
  const identity = rateLimitIdentity({
    ip: getClientIp(request),
    category,
  });
  const rate = consumeRateLimit({ category, identity });

  if (!rate.allowed) {
    incrementSecurityMetric("rateLimitEvents");
    incrementSecurityMetric("blockedRequests");
    const body = rateLimitExceededBody(rate);
    const limited = NextResponse.json(body, {
      status: 429,
      headers: {
        "Retry-After": String(rate.retryAfterSec),
        "Cache-Control": "no-store",
      },
    });
    return withGuardHeaders(limited, pathname, rate);
  }

  const csrf = assertCsrfRequest(request);
  if (!csrf.ok) {
    incrementSecurityMetric("csrfFailures");
    incrementSecurityMetric("blockedRequests");
    const forbidden = NextResponse.json(
      {
        error: "csrf_rejected",
        message: "Cross-site request blocked.",
        reason: csrf.reason,
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
    return withGuardHeaders(forbidden, pathname, rate);
  }

  // Stash rate metadata on a request header for post-auth response enrichment.
  // (NextRequest headers are immutable in some runtimes — apply on the way out.)
  (request as NextRequest & { __rateLimit?: typeof rate }).__rateLimit = rate;
  return null;
}

export function finalizeGuardedResponse(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const pathname = request.nextUrl.pathname;
  const rate = (request as NextRequest & { __rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: number;
  } }).__rateLimit;

  return withGuardHeaders(response, pathname, rate);
}
