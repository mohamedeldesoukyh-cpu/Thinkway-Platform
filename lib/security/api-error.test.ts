import assert from "node:assert/strict";
import test from "node:test";

import { parseApiError } from "./api-error";

test("parseApiError prefers friendly rate-limit message over raw code", async () => {
  const response = new Response(
    JSON.stringify({
      error: "rate_limit_exceeded",
      message: "You're sending AI requests too quickly. Try again in 12s.",
      category: "ai",
      limit: 10,
      retryAfterSec: 12,
    }),
    {
      status: 429,
      headers: {
        "Retry-After": "12",
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "0",
      },
    }
  );

  const parsed = await parseApiError(response, "Chat request failed");
  assert.equal(parsed.status, 429);
  assert.equal(parsed.code, "rate_limit_exceeded");
  assert.equal(parsed.retryAfterSec, 12);
  assert.equal(parsed.category, "ai");
  assert.match(parsed.message, /too quickly/i);
  assert.doesNotMatch(parsed.message, /^rate_limit_exceeded$/);
});

test("parseApiError prefers message over machine error codes for non-429", async () => {
  const response = new Response(
    JSON.stringify({
      error: "csrf_rejected",
      message: "Cross-site request blocked.",
    }),
    { status: 403 }
  );

  const parsed = await parseApiError(response, "Request failed");
  assert.equal(parsed.message, "Cross-site request blocked.");
  assert.equal(parsed.code, "csrf_rejected");
});
