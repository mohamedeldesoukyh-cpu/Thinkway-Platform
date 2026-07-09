#!/usr/bin/env node
/**
 * Phase 0.2 infrastructure validation — health endpoints, logger, env matrix.
 * Run: npx tsx scripts/validate-infra-phase02.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DOCS = path.join(ROOT, "docs", "infrastructure");

type Finding = { id: string; severity: "P0" | "P1" | "P2"; message: string };

const findings: Finding[] = [];
let passed = 0;

function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(finding: Finding) {
  findings.push(finding);
  console.log(`  ✗ [${finding.severity}] ${finding.message}`);
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function fileContains(rel: string, needle: string): boolean {
  return fs.readFileSync(path.join(ROOT, rel), "utf8").includes(needle);
}

console.log("\n=== Phase 0.2 Infrastructure Validation ===\n");

// 1. Documentation
console.log("1. Infrastructure documentation");
for (const doc of [
  "ENVIRONMENT_MATRIX.md",
  "PRODUCTION_DEPLOYMENT_CHECKLIST.md",
  "ROLLBACK_CHECKLIST.md",
  "MIGRATION_CHECKLIST.md",
  "SECRETS_CHECKLIST.md",
  "WORKER_OPERATIONS.md",
  "INFRASTRUCTURE_READINESS_REPORT.md",
]) {
  if (fileExists(`docs/infrastructure/${doc}`)) ok(`${doc} exists`);
  else fail({ id: `DOC-${doc}`, severity: "P0", message: `Missing docs/infrastructure/${doc}` });
}

// 2. Observability modules
console.log("\n2. Observability modules");
for (const mod of [
  "lib/observability/structured-logger.ts",
  "lib/observability/error-reporter.ts",
  "lib/observability/request-context.ts",
  "lib/observability/health-checks.ts",
  "lib/observability/workflow-metrics.ts",
  "lib/observability/discovery-metrics.ts",
  "lib/observability/worker-heartbeat.ts",
  "lib/observability/queue-report.ts",
]) {
  if (fileExists(mod)) ok(path.basename(mod));
  else fail({ id: `MOD-${mod}`, severity: "P0", message: `Missing ${mod}` });
}

// 3. Logger exports
console.log("\n3. Structured logger exports");
const logger = fs.readFileSync(path.join(ROOT, "lib/platform/logger.ts"), "utf8");
for (const fn of ["errorLog", "warnLog", "infoLog"]) {
  if (logger.includes(fn)) ok(`logger exports ${fn}`);
  else fail({ id: `LOG-${fn}`, severity: "P0", message: `logger missing ${fn}` });
}
if (fileExists("lib/observability/structured-logger.ts")) ok("structured-logger module exists");
else fail({ id: "LOG-STRUCT", severity: "P0", message: "Missing structured-logger module" });

// 4. Health endpoints
console.log("\n4. Health endpoints");
for (const route of ["health", "ready", "version"]) {
  const p = `app/api/${route}/route.ts`;
  if (fileExists(p)) ok(`/api/${route}`);
  else fail({ id: `HEALTH-${route}`, severity: "P0", message: `Missing ${p}` });
}

if (fileExists("app/api/admin/queues/route.ts")) ok("/api/admin/queues");
else fail({ id: "QUEUES-ROUTE", severity: "P1", message: "Missing /api/admin/queues" });

// 5. Public route registration
console.log("\n5. Public health routes in auth middleware");
const routes = fs.readFileSync(path.join(ROOT, "lib/auth/routes.ts"), "utf8");
for (const ep of ["/api/health", "/api/ready", "/api/version"]) {
  if (routes.includes(ep)) ok(`${ep} is public`);
  else fail({ id: `PUB-${ep}`, severity: "P0", message: `${ep} not in PUBLIC_ROUTE_PREFIXES` });
}

// 6. Env example
console.log("\n6. Environment example");
if (fileExists(".env.example")) {
  ok(".env.example exists");
  if (fileContains(".env.example", "SENTRY_DSN")) ok(".env.example documents SENTRY_DSN");
  else fail({ id: "ENV-SENTRY", severity: "P1", message: ".env.example missing SENTRY_DSN" });
  if (fileContains(".env.example", "THINKWAY_ENV")) ok(".env.example documents THINKWAY_ENV");
  else fail({ id: "ENV-THINKWAY", severity: "P1", message: ".env.example missing THINKWAY_ENV" });
} else {
  fail({ id: "ENV-EXAMPLE", severity: "P0", message: "Missing .env.example" });
}

// 7. Worker heartbeat
console.log("\n7. Worker heartbeat");
if (fileExists("services/discovery-worker/src/observability/heartbeat.ts")) ok("worker heartbeat module");
else fail({ id: "WORKER-HB", severity: "P0", message: "Missing worker heartbeat module" });

if (fileContains("services/discovery-worker/src/index.ts", "startWorkerHeartbeat"))
  ok("worker index starts heartbeat");
else
  fail({ id: "WORKER-HB-START", severity: "P0", message: "Worker index missing startWorkerHeartbeat" });

// 8. API boundary instrumentation
console.log("\n8. Critical path instrumentation");
if (fileContains("app/api/ai/chat/route.ts", "recordWorkflowMetrics"))
  ok("AI chat route has workflow metrics");
else
  fail({ id: "AI-METRICS", severity: "P1", message: "AI chat route missing workflow metrics" });

if (fileContains("lib/creators/search-trace.ts", "emitDiscoveryStructuredLog"))
  ok("search-trace bridges to discovery metrics");
else if (fileContains("lib/creators/search-trace.ts", "DISCOVERY_STRUCTURED_METRICS_ENABLED"))
  ok("search-trace has prod metrics flag");
else
  fail({ id: "DISC-METRICS", severity: "P1", message: "search-trace missing prod metrics bridge" });

// Summary
console.log("\n=== Summary ===");
console.log(`Passed checks: ${passed}`);
console.log(`Findings: ${findings.length}`);
const p0 = findings.filter((f) => f.severity === "P0");
const p1 = findings.filter((f) => f.severity === "P1");
console.log(`  P0: ${p0.length}  P1: ${p1.length}  P2: ${findings.length - p0.length - p1.length}`);

const reportPath = path.join(DOCS, "validation-phase02-report.json");
fs.mkdirSync(DOCS, { recursive: true });
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      passed,
      findings,
      p0Count: p0.length,
      readinessScore: Math.max(0, 100 - p0.length * 15 - p1.length * 5),
      ready: p0.length === 0,
    },
    null,
    2
  )
);
console.log(`\nReport written to ${path.relative(ROOT, reportPath)}`);

process.exit(p0.length > 0 ? 1 : 0);
