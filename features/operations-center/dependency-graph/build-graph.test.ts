import assert from "node:assert/strict";
import test from "node:test";

import { buildDependencyGraph } from "./build-graph";
import type { HealthCheckResult } from "../types";

test("buildDependencyGraph wires Users → Next.js → API chain", () => {
  const components: HealthCheckResult[] = [
    {
      id: "nextjs",
      name: "Next.js",
      kind: "infrastructure",
      status: "healthy",
      latencyMs: 2,
      checkedAt: new Date().toISOString(),
      score: 100,
    },
    {
      id: "redis",
      name: "Redis",
      kind: "infrastructure",
      status: "offline",
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      score: 0,
      lastFailure: "down",
    },
  ];
  const graph = buildDependencyGraph(components);
  assert.ok(graph.nodes.some((n) => n.id === "users"));
  assert.ok(graph.edges.some((e) => e.from === "users" && e.to === "nextjs"));
  assert.ok(graph.edges.some((e) => e.from === "api" && e.to === "supabase"));
  const redis = graph.nodes.find((n) => n.id === "redis");
  assert.equal(redis?.status, "offline");
  assert.equal(redis?.lastFailure, "down");
});
