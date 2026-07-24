import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureDefaultHealthProviders,
  getHealthProvider,
  listHealthProviders,
  registerHealthProvider,
  resetHealthProviderRegistry,
} from "./registry";
import { resultBase, type HealthProvider } from "./types";

test("registerHealthProvider adds adapters", () => {
  resetHealthProviderRegistry();
  const custom: HealthProvider = {
    id: "custom-probe",
    name: "Custom",
    kind: "infrastructure",
    async check() {
      return resultBase(this, {
        status: "healthy",
        latencyMs: 1,
        message: "ok",
      });
    },
  };
  registerHealthProvider(custom);
  assert.equal(getHealthProvider("custom-probe")?.name, "Custom");
  assert.equal(listHealthProviders().length, 1);
});

test("ensureDefaultHealthProviders registers platform adapters", () => {
  resetHealthProviderRegistry();
  ensureDefaultHealthProviders();
  const ids = listHealthProviders().map((p) => p.id);
  for (const required of [
    "nextjs",
    "supabase",
    "redis",
    "bullmq",
    "storage",
    "openai",
    "apify",
  ]) {
    assert.ok(ids.includes(required), `missing ${required}`);
  }
});
