import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEnvironmentSwitchHref,
  getDeploymentSurface,
  getDeploymentSurfaceLabel,
} from "./deployment-environment";

test("getDeploymentSurface respects THINKWAY_ENV", () => {
  const prev = {
    THINKWAY_ENV: process.env.THINKWAY_ENV,
    NEXT_PUBLIC_THINKWAY_ENV: process.env.NEXT_PUBLIC_THINKWAY_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
  try {
    process.env.THINKWAY_ENV = "development";
    delete process.env.NEXT_PUBLIC_THINKWAY_ENV;
    delete process.env.VERCEL_ENV;
    assert.equal(getDeploymentSurface(), "development");
    assert.equal(getDeploymentSurfaceLabel(), "Development");

    process.env.THINKWAY_ENV = "production";
    assert.equal(getDeploymentSurface(), "production");
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("environment switch builds absolute sibling URLs", () => {
  const href = buildEnvironmentSwitchHref("production", "/operations?tab=queues");
  assert.match(href, /^https:\/\/app\.thinkwaymedia\.com\/operations\?tab=queues$/);
});
