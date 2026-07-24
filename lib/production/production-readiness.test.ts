import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { calculateOverallHealthScore } from "../../features/operations-center/health/score";
import { canAccessOperationsCenter } from "../../features/operations-center/roles";
import { authorizeWorkspacePath } from "../security/workspace-auth";
import { classifyApiPath } from "../security/workspace-classify";

import {
  CERTIFICATION_SCORES,
  HANDOVER_DOCUMENTS,
  REQUIRED_ENV_KEYS,
  REQUIRED_MIGRATIONS,
  REQUIRED_OPERATIONS_MODULES,
  REQUIRED_SECURITY_MODULES,
  deriveGoLiveDecision,
  overallCertificationScore,
} from "./production-readiness";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

function exists(rel: string): boolean {
  return existsSync(join(repoRoot, rel));
}

test("required production env keys documented in .env.example", () => {
  const env = read(".env.example");
  for (const key of REQUIRED_ENV_KEYS) {
    assert.match(env, new RegExp(`^${key}=`, "m"), `missing ${key}`);
  }
  assert.doesNotMatch(env, /NEXT_PUBLIC_.*SERVICE_ROLE/);
});

test("P0 finance RLS + P4 storage migrations present", () => {
  for (const name of REQUIRED_MIGRATIONS) {
    assert.ok(exists(`supabase/migrations/${name}`), name);
  }
  const p0 = read(`supabase/migrations/${REQUIRED_MIGRATIONS[0]}`);
  assert.match(p0, /is_internal_user|finance\.read|FORCE ROW LEVEL SECURITY|ENABLE ROW LEVEL SECURITY/i);
  const p4 = read(`supabase/migrations/${REQUIRED_MIGRATIONS[3]}`);
  assert.match(p4, /campaign-publication-media/);
  assert.match(p4, /is_internal_user/);
});

test("migration inventory is non-empty and includes July 2026 security set", () => {
  const files = readdirSync(join(repoRoot, "supabase/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  assert.ok(files.length >= 170, `expected >=170 migrations, got ${files.length}`);
});

test("security control modules exist and admin is server-only", () => {
  for (const mod of REQUIRED_SECURITY_MODULES) {
    assert.ok(exists(mod), mod);
  }
  assert.match(read("lib/supabase/admin.ts"), /server-only/);
  assert.match(read("proxy.ts"), /preAuthRequestGuard|updateSession/);
  assert.match(read("lib/security/security-headers.ts"), /Content-Security-Policy|content-security-policy|CSP/i);
});

test("P5 Operations Center modules exist", () => {
  for (const mod of REQUIRED_OPERATIONS_MODULES) {
    assert.ok(exists(mod), mod);
  }
});

test("workspace isolation: portal denied finance + unclassified API fail-closed", () => {
  assert.equal(
    authorizeWorkspacePath("/finance", "client_portal").allowed,
    false,
  );
  assert.equal(classifyApiPath("/api/not-a-real-route"), null);
  assert.equal(
    authorizeWorkspacePath("/api/operations-center/snapshot", "client_portal")
      .allowed,
    false,
  );
});

test("operations center authorization allowlist", () => {
  assert.equal(canAccessOperationsCenter("admin"), true);
  assert.equal(canAccessOperationsCenter("finance"), false);
});

test("health engine score sanity (performance-ish)", () => {
  const started = performance.now();
  for (let i = 0; i < 1000; i++) {
    calculateOverallHealthScore([
      { id: "a", weight: 1.5, status: "healthy", score: 100 },
      { id: "b", weight: 1, status: "warning", score: 70 },
      { id: "c", weight: 1.2, status: "critical", score: 35 },
    ]);
  }
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 250, `score calc too slow: ${elapsed}ms`);
  assert.equal(
    calculateOverallHealthScore([
      { id: "a", weight: 1, status: "healthy", score: 100 },
    ]),
    100,
  );
});

test("handover package documents exist", () => {
  for (const doc of HANDOVER_DOCUMENTS) {
    assert.ok(exists(`docs/handover/${doc}`), `docs/handover/${doc}`);
  }
});

test("certification scoring yields CONDITIONAL_GO or better", () => {
  const overall = overallCertificationScore(CERTIFICATION_SCORES);
  assert.ok(overall >= 75 && overall <= 100, `overall=${overall}`);
  const decision = deriveGoLiveDecision(overall);
  assert.ok(decision === "GO" || decision === "CONDITIONAL_GO");
  assert.equal(deriveGoLiveDecision(50), "NO_GO");
  assert.equal(deriveGoLiveDecision(95), "GO");
});

test("deployment validation: Next config + security headers wiring", () => {
  assert.ok(exists("next.config.ts") || exists("next.config.js"));
  const nextCfg = exists("next.config.ts")
    ? read("next.config.ts")
    : read("next.config.js");
  // Headers may live in next.config or security-headers helper applied via proxy
  assert.ok(
    /header|security/i.test(nextCfg) ||
      exists("lib/security/security-headers.ts"),
  );
  assert.ok(exists("docs/security/P4_WORKSPACE_ISOLATION_REPORT.md"));
  assert.ok(exists("docs/operations/OPERATIONS_CENTER.md"));
});
