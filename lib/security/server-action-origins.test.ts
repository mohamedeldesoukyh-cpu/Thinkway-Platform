import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveServerActionAllowedOrigins } from "@/lib/security/server-action-origins";

describe("resolveServerActionAllowedOrigins", () => {
  it("always allows localhost and vercel.app wildcard", () => {
    const origins = resolveServerActionAllowedOrigins({});
    assert.ok(origins.includes("localhost:3000"));
    assert.ok(origins.includes("*.vercel.app"));
  });

  it("includes Thinkway app hosts and Vercel system URLs", () => {
    const origins = resolveServerActionAllowedOrigins({
      NEXT_PUBLIC_APP_URL: "https://dev.thinkwaymedia.com",
      CSRF_ALLOWED_ORIGINS: "https://app.thinkwaymedia.com",
      VERCEL_URL: "thinkway-platform-abc123-team.vercel.app",
      VERCEL_BRANCH_URL: "thinkway-platform-git-develop-team.vercel.app",
    });
    assert.ok(origins.includes("dev.thinkwaymedia.com"));
    assert.ok(origins.includes("app.thinkwaymedia.com"));
    assert.ok(origins.includes("thinkway-platform-abc123-team.vercel.app"));
    assert.ok(origins.includes("thinkway-platform-git-develop-team.vercel.app"));
    assert.ok(origins.includes("*.vercel.app"));
  });
});
