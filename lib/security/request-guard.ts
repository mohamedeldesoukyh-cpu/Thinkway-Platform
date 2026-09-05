import { type NextRequest, NextResponse } from "next/server";

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

function getRequestClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

function isServerActionRequest(request: NextRequest): boolean {
  if (request.headers.has("next-action") || request.headers.has("Next-Action")) {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return request.method === "POST" && accept.includes("text/x-component");
}

function isGetPageRequest(request: NextRequest, pathname: string): boolean {
  return request.method.toUpperCase() === "GET" && !isApiPath(pathname);
}

function isRouterPrefetch(request: NextRequest): boolean {
  const prefetch = request.headers.get("next-router-prefetch");
  return prefetch === "1" || prefetch === "true";
}

/** Next.js RSC flight for a page (not an API route or Server Action). */
function isPageRscGet(
  request: NextRequest,
  pathname: string,
  serverAction: boolean
): boolean {
  if (!isGetPageRequest(request, pathname) || serverAction) return false;
  const accept = request.headers.get("accept") ?? "";
  const rsc = request.headers.get("rsc");
  return rsc === "1" || accept.includes("text/x-component");
}

/**
 * Sidebar / App Router prefetches must not consume the default page bucket.
 * API prefetches and non-default categories (discovery, export, …) still count.
 */
function skipDefaultPagePrefetchConsume(
  request: NextRequest,
  pathname: string,
  category: string
): boolean {
  return (
    category === "default" &&
    isGetPageRequest(request, pathname) &&
    isRouterPrefetch(request)
  );
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
    ip: getRequestClientIp(request),
    category,
  });
  const rate = skipDefaultPagePrefetchConsume(request, pathname, category)
    ? null
    : consumeRateLimit({ category, identity });

  if (rate && !rate.allowed) {
    incrementSecurityMetric("rateLimitEvents");
    incrementSecurityMetric("blockedRequests");
    const body = rateLimitExceededBody(rate);
    // Structured edge log — provider is Thinkway's own limiter, not OpenAI/etc.
    console.warn(
      JSON.stringify({
        event: "rate_limit_exceeded",
        provider: "thinkway_edge",
        model: null,
        tokens: null,
        category: rate.category,
        limit: rate.limit,
        remaining: rate.remaining,
        retryAfterSec: rate.retryAfterSec,
        resetAt: rate.resetAt,
        identity,
        pathname,
        method: request.method,
        durationMs: null,
        retryCount: 0,
        rateLimitHeaders: {
          "Retry-After": rate.retryAfterSec,
          "X-RateLimit-Limit": rate.limit,
          "X-RateLimit-Remaining": 0,
          "X-RateLimit-Reset": Math.ceil(rate.resetAt / 1000),
        },
      })
    );

    const rateHeaders = {
      "Retry-After": String(rate.retryAfterSec),
      "Cache-Control": "no-store",
    };

    // Document and page RSC flights cannot render JSON 429 — return HTML.
    const accept = request.headers.get("accept") ?? "";
    const wantsHtml =
      !isApiPath(pathname) &&
      !serverAction &&
      (accept.includes("text/html") ||
        accept === "" ||
        accept.includes("*/*") ||
        isPageRscGet(request, pathname, serverAction));

    if (wantsHtml) {
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Too many requests</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fff;color:#111}main{max-width:28rem;padding:1.5rem;text-align:center}p{color:#555;line-height:1.5}a,button{margin:.5rem;padding:.6rem 1rem;border-radius:.5rem;border:1px solid #ccc;background:#111;color:#fff;text-decoration:none;font:inherit;cursor:pointer}a.secondary{background:#fff;color:#111}</style></head><body><main><h1>Too many requests</h1><p>${body.message}</p><p><button type="button" onclick="location.reload()">Reload</button> <a class="secondary" href="/login">Back to sign in</a></p></main></body></html>`;
      const limited = new NextResponse(html, {
        status: 429,
        headers: { ...rateHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
      return withGuardHeaders(limited, pathname, rate);
    }

    const limited = NextResponse.json(body, {
      status: 429,
      headers: rateHeaders,
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
    return withGuardHeaders(forbidden, pathname, rate ?? undefined);
  }

  // Stash rate metadata on a request header for post-auth response enrichment.
  // (NextRequest headers are immutable in some runtimes — apply on the way out.)
  if (rate) {
    (request as NextRequest & { __rateLimit?: typeof rate }).__rateLimit = rate;
  }
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
