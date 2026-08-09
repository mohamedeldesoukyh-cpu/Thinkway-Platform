import assert from "node:assert/strict";
import test from "node:test";

import { resolveBuildIdentity, resolveReleaseEnvironment } from "./release-info";

test("resolveReleaseEnvironment maps production", () => {
  assert.equal(resolveReleaseEnvironment("production", "preview"), "production");
  assert.equal(resolveReleaseEnvironment(null, "production"), "production");
  assert.equal(resolveReleaseEnvironment("prod", null), "production");
});

test("resolveReleaseEnvironment maps preview", () => {
  assert.equal(resolveReleaseEnvironment(null, "preview"), "preview");
  assert.equal(resolveReleaseEnvironment("staging", "development"), "preview");
});

test("resolveReleaseEnvironment defaults to development", () => {
  assert.equal(resolveReleaseEnvironment(null, null), "development");
  assert.equal(resolveReleaseEnvironment("development", "development"), "development");
  assert.equal(resolveReleaseEnvironment("local", undefined), "development");
});

test("resolveBuildIdentity prefers git SHA", () => {
  assert.equal(
    resolveBuildIdentity({
      VERCEL_GIT_COMMIT_SHA: "abcdef1234567890",
      VERCEL_DEPLOYMENT_ID: "dpl_shouldNotWin",
    } as NodeJS.ProcessEnv),
    "abcdef1"
  );
});

test("resolveBuildIdentity falls back to deployment id for CLI deploys", () => {
  assert.equal(
    resolveBuildIdentity({
      VERCEL_DEPLOYMENT_ID: "dpl_8DjtXqXeuihYJE24krrWprL2iGa5",
    } as NodeJS.ProcessEnv),
    "8DjtXqXeuihY"
  );
});

test("resolveBuildIdentity falls back to build timestamp", () => {
  const id = resolveBuildIdentity({
    NEXT_PUBLIC_BUILD_TIMESTAMP: "2026-08-09T03:12:00.000Z",
  } as NodeJS.ProcessEnv);
  assert.match(id, /^t[0-9a-z]+$/);
  assert.notEqual(id, "local");
});

test("resolveBuildIdentity defaults to local", () => {
  assert.equal(resolveBuildIdentity({} as NodeJS.ProcessEnv), "local");
});
