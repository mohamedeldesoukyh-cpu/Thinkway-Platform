import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeNextPathForActor } from "../auth/routes";

import {
  authorizeWorkspacePath,
  pathBlockedForPortal,
  portalHomePath,
} from "./workspace-auth";

test("portal actors blocked from Finance / Ops / Billing / Admin pages", () => {
  for (const path of [
    "/finance",
    "/finance/invoices",
    "/operations/move",
    "/billing",
    "/collections",
    "/treasury",
    "/reports/pnl",
    "/settings/users",
    "/system/health",
    "/discovery",
    "/ai",
    "/",
  ]) {
    assert.equal(pathBlockedForPortal(path), true, path);
    const client = authorizeWorkspacePath(path, "client_portal");
    const creator = authorizeWorkspacePath(path, "creator_portal");
    assert.equal(client.allowed, false, `client → ${path}`);
    assert.equal(creator.allowed, false, `creator → ${path}`);
  }
});

test("portal actors blocked from internal / admin / service APIs", () => {
  for (const path of [
    "/api/ai/chat",
    "/api/discovery/search",
    "/api/operations/campaigns",
    "/api/reports/pnl/document",
    "/api/admin/queues",
    "/api/quotations/x/export",
    "/api/invoices/x/document",
    "/api/cron/publication-metrics",
  ]) {
    assert.equal(pathBlockedForPortal(path), true, path);
    assert.equal(authorizeWorkspacePath(path, "client_portal").allowed, false);
  }
});

test("portal actors allowed on their workspace pages", () => {
  assert.equal(
    authorizeWorkspacePath("/client-portal/campaigns", "client_portal").allowed,
    true,
  );
  assert.equal(
    authorizeWorkspacePath("/creator-portal/deliverables", "creator_portal")
      .allowed,
    true,
  );
  assert.equal(
    authorizeWorkspacePath("/creator-portal/profile", "creator_portal").allowed,
    true,
  );
});

test("internal staff allowed on internal workspace", () => {
  assert.equal(
    authorizeWorkspacePath("/finance/po-tracker", "internal").allowed,
    true,
  );
  assert.equal(
    authorizeWorkspacePath("/api/discovery/search", "internal").allowed,
    true,
  );
  assert.equal(
    authorizeWorkspacePath("/api/admin/queues", "internal").allowed,
    true,
  );
});

test("unclassified API denied for authenticated actors", () => {
  const decision = authorizeWorkspacePath(
    "/api/not-registered/leak",
    "internal",
  );
  assert.equal(decision.allowed, false);
  assert.match(decision.reason ?? "", /Unclassified/);
});

test("anonymous denied on internal surfaces", () => {
  assert.equal(authorizeWorkspacePath("/finance", "anonymous").allowed, false);
  assert.equal(authorizeWorkspacePath("/api/ai/chat", "anonymous").allowed, false);
  assert.equal(authorizeWorkspacePath("/login", "anonymous").allowed, true);
  assert.equal(authorizeWorkspacePath("/creator-invite", "anonymous").allowed, true);
  assert.equal(authorizeWorkspacePath("/api/health", "anonymous").allowed, true);
});

test("sanitizeNextPathForActor keeps portal users out of internal next=", () => {
  assert.equal(
    sanitizeNextPathForActor("/finance/invoices", "client_portal"),
    "/client-portal",
  );
  assert.equal(
    sanitizeNextPathForActor("/discovery", "creator_portal"),
    "/creator-portal",
  );
  assert.equal(
    sanitizeNextPathForActor("/client-portal/reports", "client_portal"),
    "/client-portal/reports",
  );
  assert.equal(
    sanitizeNextPathForActor("/finance", "internal"),
    "/finance",
  );
});

test("portalHomePath", () => {
  assert.equal(portalHomePath("client_portal"), "/client-portal");
  assert.equal(portalHomePath("creator_portal"), "/creator-portal");
});
