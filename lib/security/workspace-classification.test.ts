import assert from "node:assert/strict";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { API_ROUTE_CLASSIFICATIONS } from "./workspace-classification-registry";
import {
  classifyApiPath,
  classifyPagePath,
  classifyPath,
  classifyServerActionModule,
  normalizeApiPathForClassification,
} from "./workspace-classify";
import {
  apiFileToPath,
  listApiRouteFiles,
  listPageFiles,
  listServerActionModules,
  pageFileToPath,
} from "./workspace-inventory";
import { WORKSPACE_CLASSES } from "./workspace-class";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("every registered API class is a known WorkspaceClass", () => {
  for (const [path, cls] of Object.entries(API_ROUTE_CLASSIFICATIONS)) {
    assert.ok(
      (WORKSPACE_CLASSES as readonly string[]).includes(cls),
      `${path} has invalid class ${cls}`,
    );
  }
});

test("classifyApiPath resolves dynamic segments", () => {
  assert.equal(
    classifyApiPath("/api/ai/conversations/abc-123"),
    "internal_workspace",
  );
  assert.equal(
    classifyApiPath("/api/quotations/uuid-here/export"),
    "internal_workspace",
  );
  assert.equal(
    classifyApiPath("/api/campaigns/11111111-1111-4111-8111-111111111111/publications"),
    "internal_workspace",
  );
  assert.equal(classifyApiPath("/api/admin/queues"), "admin_only");
  assert.equal(classifyApiPath("/api/cron/publication-metrics"), "service_only");
  assert.equal(classifyApiPath("/api/health"), "public");
});

test("unregistered API paths classify as null (fail-closed)", () => {
  assert.equal(classifyApiPath("/api/secret/backdoor"), null);
  assert.equal(classifyApiPath("/api/finance/leak"), null);
});

test("page prefix classification covers isolation zones", () => {
  assert.equal(classifyPagePath("/finance/invoices"), "internal_workspace");
  assert.equal(classifyPagePath("/operations/move"), "internal_workspace");
  assert.equal(classifyPagePath("/billing"), "internal_workspace");
  assert.equal(classifyPagePath("/system/health"), "admin_only");
  assert.equal(classifyPagePath("/client-portal/campaigns"), "client_workspace");
  assert.equal(classifyPagePath("/creator-portal/payments"), "client_workspace");
  assert.equal(classifyPagePath("/login"), "public");
  assert.equal(classifyPagePath("/discovery"), "internal_workspace");
});

test("API route filesystem inventory is fully classified", () => {
  const files = listApiRouteFiles(repoRoot);
  assert.ok(files.length > 0, "expected API route files");
  const missing: string[] = [];
  for (const file of files) {
    const path = apiFileToPath(repoRoot, file);
    const cls = classifyApiPath(path);
    if (cls === null) missing.push(path);
  }
  assert.deepEqual(missing, [], `Unclassified API routes:\n${missing.join("\n")}`);
});

test("page filesystem inventory is fully classified", () => {
  const files = listPageFiles(repoRoot);
  assert.ok(files.length > 0, "expected page files");
  const missing: string[] = [];
  for (const file of files) {
    const path = pageFileToPath(repoRoot, file);
    const cls = classifyPagePath(path);
    if (cls === null) missing.push(`${path} (${file})`);
  }
  assert.deepEqual(missing, [], `Unclassified pages:\n${missing.join("\n")}`);
});

test("server action modules map to a workspace class", () => {
  const modules = listServerActionModules(repoRoot);
  assert.ok(modules.length > 20, "expected many server action modules");
  const missing: string[] = [];
  for (const file of modules) {
    const rel = file.replace(/\\/g, "/");
    const cls = classifyServerActionModule(rel);
    if (cls === null) missing.push(rel);
  }
  assert.deepEqual(
    missing,
    [],
    `Unclassified server action modules:\n${missing.join("\n")}`,
  );
});

test("normalizeApiPathForClassification prefers templates", () => {
  assert.equal(
    normalizeApiPathForClassification("/api/reports/pnl/document"),
    "/api/reports/pnl/document",
  );
  assert.equal(
    normalizeApiPathForClassification("/api/clients/abc/documents"),
    "/api/clients/[clientId]/documents",
  );
});

test("classifyPath dispatches api vs page", () => {
  assert.equal(classifyPath("/api/version"), "public");
  assert.equal(classifyPath("/settings/users"), "internal_workspace");
});
