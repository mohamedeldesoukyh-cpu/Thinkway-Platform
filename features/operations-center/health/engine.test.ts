import assert from "node:assert/strict";
import test from "node:test";

import {
  registerHealthProvider,
  resetHealthProviderRegistry,
} from "../adapters/registry";
import { resultBase, type HealthProvider } from "../adapters/types";
import { runHealthEngine } from "./engine";

test("runHealthEngine aggregates provider results into overallHealthScore", async () => {
  resetHealthProviderRegistry();
  const healthy: HealthProvider = {
    id: "probe-a",
    name: "A",
    kind: "infrastructure",
    weight: 1,
    async check() {
      return resultBase(this, {
        status: "healthy",
        latencyMs: 5,
        message: "ok",
      });
    },
  };
  const warn: HealthProvider = {
    id: "probe-b",
    name: "B",
    kind: "infrastructure",
    weight: 1,
    async check() {
      return resultBase(this, {
        status: "warning",
        latencyMs: 900,
        message: "slow",
      });
    },
  };
  registerHealthProvider(healthy);
  registerHealthProvider(warn);

  const report = await runHealthEngine();
  assert.equal(report.components.length, 2);
  assert.ok(report.overallHealthScore >= 70 && report.overallHealthScore <= 100);
  assert.ok(["healthy", "warning"].includes(report.overallStatus));
});
