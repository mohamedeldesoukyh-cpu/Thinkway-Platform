import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { RATE_LIMIT_RULES, resetRateLimitStoreForTests } from "./rate-limit";
import { preAuthRequestGuard } from "./request-guard";

const DEFAULT_MAX = RATE_LIMIT_RULES.default.max;

function pageRequest(init: {
  path?: string;
  method?: string;
  accept?: string;
  rsc?: string;
  prefetch?: string;
  ip?: string;
}): NextRequest {
  const headers = new Headers();
  headers.set("x-forwarded-for", init.ip ?? "203.0.113.50");
  if (init.accept) headers.set("accept", init.accept);
  if (init.rsc) headers.set("rsc", init.rsc);
  if (init.prefetch) headers.set("next-router-prefetch", init.prefetch);
  return new NextRequest(`https://dev.thinkwaymedia.com${init.path ?? "/billing"}`, {
    method: init.method ?? "GET",
    headers,
  });
}

function rateOn(request: NextRequest): { remaining: number; limit: number } | null {
  const rate = (
    request as NextRequest & {
      __rateLimit?: { remaining: number; limit: number };
    }
  ).__rateLimit;
  return rate ? { remaining: rate.remaining, limit: rate.limit } : null;
}

test("page RSC GET 429 is HTML, never JSON", async () => {
  resetRateLimitStoreForTests();
  const ip = "203.0.113.51";
  for (let i = 0; i < DEFAULT_MAX; i += 1) {
    const allowed = preAuthRequestGuard(
      pageRequest({ ip, path: "/campaigns", accept: "text/html" })
    );
    assert.equal(allowed, null);
  }

  const rsc = preAuthRequestGuard(
    pageRequest({
      ip,
      path: "/campaigns",
      accept: "text/x-component",
      rsc: "1",
    })
  );
  assert.ok(rsc);
  assert.equal(rsc.status, 429);
  assert.match(rsc.headers.get("content-type") ?? "", /text\/html/);
  const html = await rsc.text();
  assert.match(html, /Too many requests/);
  assert.doesNotMatch(html, /rate_limit_exceeded/);
});

test("document GET 429 stays the existing HTML page", async () => {
  resetRateLimitStoreForTests();
  const ip = "203.0.113.52";
  for (let i = 0; i < DEFAULT_MAX; i += 1) {
    assert.equal(
      preAuthRequestGuard(pageRequest({ ip, path: "/campaigns", accept: "text/html" })),
      null
    );
  }

  const blocked = preAuthRequestGuard(
    pageRequest({ ip, path: "/campaigns", accept: "text/html" })
  );
  assert.ok(blocked);
  assert.equal(blocked.status, 429);
  assert.match(blocked.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await blocked.text(), /Too many requests/);
});

test("API 429 remains JSON even with RSC Accept", async () => {
  resetRateLimitStoreForTests();
  const ip = "203.0.113.53";
  for (let i = 0; i < DEFAULT_MAX; i += 1) {
    assert.equal(
      preAuthRequestGuard(
        pageRequest({ ip, path: "/api/campaigns/x", accept: "application/json" })
      ),
      null
    );
  }

  const blocked = preAuthRequestGuard(
    pageRequest({
      ip,
      path: "/api/campaigns/x",
      accept: "text/x-component",
      rsc: "1",
    })
  );
  assert.ok(blocked);
  assert.equal(blocked.status, 429);
  assert.match(blocked.headers.get("content-type") ?? "", /application\/json/);
  const body = (await blocked.json()) as { error: string; category: string };
  assert.equal(body.error, "rate_limit_exceeded");
  assert.equal(body.category, "default");
});

test("Next-Router-Prefetch GET pages do not consume the default bucket", () => {
  resetRateLimitStoreForTests();
  const ip = "203.0.113.54";

  for (let i = 0; i < 8; i += 1) {
    const prefetch = pageRequest({
      ip,
      path: "/billing",
      accept: "text/x-component",
      rsc: "1",
      prefetch: "1",
    });
    assert.equal(preAuthRequestGuard(prefetch), null);
    assert.equal(rateOn(prefetch), null);
  }

  const real = pageRequest({ ip, path: "/billing", accept: "text/html" });
  assert.equal(preAuthRequestGuard(real), null);
  const consumed = rateOn(real);
  assert.ok(consumed);
  assert.equal(consumed.limit, DEFAULT_MAX);
  assert.equal(consumed.remaining, DEFAULT_MAX - 1);
});

test("API prefetch still consumes the default bucket", () => {
  resetRateLimitStoreForTests();
  const ip = "203.0.113.55";
  const prefetch = pageRequest({
    ip,
    path: "/api/campaigns/x",
    accept: "application/json",
    prefetch: "1",
  });
  assert.equal(preAuthRequestGuard(prefetch), null);
  const consumed = rateOn(prefetch);
  assert.ok(consumed);
  assert.equal(consumed.remaining, DEFAULT_MAX - 1);
});
