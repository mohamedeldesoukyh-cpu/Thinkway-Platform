import assert from "node:assert/strict";
import test from "node:test";

import { resolveReleaseEnvironment } from "./release-info";

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
