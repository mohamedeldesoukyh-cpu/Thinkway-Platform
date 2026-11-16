import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveIoPublicAppOrigin } from "@/lib/io/io-public-app-url";

describe("resolveIoPublicAppOrigin", () => {
  it("uses the stable dev domain rather than an immutable protected preview URL", () => {
    assert.equal(resolveIoPublicAppOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "old-build.vercel.app",
      NEXT_PUBLIC_APP_URL: "https://app.thinkwaymedia.com" }), "https://dev.thinkwaymedia.com");
    assert.equal(resolveIoPublicAppOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "old-build.vercel.app",
      NEXT_PUBLIC_DEVELOPMENT_APP_URL: "https://dev.example.test/" }), "https://dev.example.test");
  });
  it("forces Production host when VERCEL_ENV=production even if APP_URL points at Dev", () => {
    assert.equal(
      resolveIoPublicAppOrigin({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://dev.thinkwaymedia.com",
        NEXT_PUBLIC_PRODUCTION_APP_URL: "https://app.thinkwaymedia.com",
      }),
      "https://app.thinkwaymedia.com"
    );
  });

  it("uses configured APP_URL on Production when it is the app host", () => {
    assert.equal(
      resolveIoPublicAppOrigin({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://app.thinkwaymedia.com",
      }),
      "https://app.thinkwaymedia.com"
    );
  });

  it("uses Dev APP_URL outside Production", () => {
    assert.equal(
      resolveIoPublicAppOrigin({
        VERCEL_ENV: "development",
        NEXT_PUBLIC_APP_URL: "https://dev.thinkwaymedia.com",
      }),
      "https://dev.thinkwaymedia.com"
    );
  });
});
