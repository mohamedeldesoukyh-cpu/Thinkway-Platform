import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeRateLimit,
  rateLimitExceededBody,
  resetRateLimitStoreForTests,
} from "./rate-limit";
import { resolveRateLimitCategory } from "./rate-limit-policy";

test("resolveRateLimitCategory maps endpoint families", () => {
  assert.equal(resolveRateLimitCategory({ pathname: "/login", method: "POST" }), "auth");
  assert.equal(
    resolveRateLimitCategory({ pathname: "/creator-invite", method: "POST", isServerAction: true }),
    "auth"
  );
  assert.equal(resolveRateLimitCategory({ pathname: "/creator-invite", method: "GET" }), "default");
  assert.equal(
    resolveRateLimitCategory({ pathname: "/auth/mfa", method: "POST", isServerAction: true }),
    "auth"
  );
  // Login / MFA page GETs must not share the tight auth mutation budget.
  assert.equal(resolveRateLimitCategory({ pathname: "/login", method: "GET" }), "default");
  assert.equal(resolveRateLimitCategory({ pathname: "/auth/mfa", method: "GET" }), "default");
  assert.equal(resolveRateLimitCategory({ pathname: "/auth/mfa/enroll", method: "GET" }), "default");
  assert.equal(resolveRateLimitCategory({ pathname: "/api/ai/chat", method: "POST" }), "ai");
  // Conversation reads and Studio page navigations must not share the AI mutation budget.
  assert.equal(
    resolveRateLimitCategory({ pathname: "/api/ai/conversations", method: "GET" }),
    "default"
  );
  assert.equal(
    resolveRateLimitCategory({ pathname: "/ai/conv-123", method: "GET" }),
    "default"
  );
  assert.equal(
    resolveRateLimitCategory({ pathname: "/api/discovery/search", method: "GET" }),
    "discovery"
  );
  assert.equal(
    resolveRateLimitCategory({
      pathname: "/api/clients/x/documents",
      method: "POST",
    }),
    "upload"
  );
  assert.equal(
    resolveRateLimitCategory({
      pathname: "/settings/users",
      method: "POST",
      isServerAction: true,
    }),
    "invite"
  );
  assert.equal(resolveRateLimitCategory({ pathname: "/api/health", method: "GET" }), "public");
  assert.equal(
    resolveRateLimitCategory({ pathname: "/api/quotations/1/export", method: "GET" }),
    "export"
  );
});

test("consumeRateLimit enforces category max and returns 429 payload shape", () => {
  resetRateLimitStoreForTests();
  const rules = {
    auth: { windowMs: 60_000, max: 2 },
    ai: { windowMs: 60_000, max: 10 },
    upload: { windowMs: 60_000, max: 10 },
    discovery: { windowMs: 60_000, max: 10 },
    public: { windowMs: 60_000, max: 10 },
    invite: { windowMs: 60_000, max: 10 },
    export: { windowMs: 60_000, max: 10 },
    default: { windowMs: 60_000, max: 10 },
  } as const;

  const first = consumeRateLimit({
    category: "auth",
    identity: "ip:1.1.1.1",
    rules,
  });
  const second = consumeRateLimit({
    category: "auth",
    identity: "ip:1.1.1.1",
    rules,
  });
  const third = consumeRateLimit({
    category: "auth",
    identity: "ip:1.1.1.1",
    rules,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);

  const body = rateLimitExceededBody(third);
  assert.equal(body.error, "rate_limit_exceeded");
  assert.equal(body.category, "auth");
  assert.ok(body.retryAfterSec >= 1);
});
