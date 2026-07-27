import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { isCreatorCrmFilterEnabled } from "./feature-flag";

const ENV_KEYS = [
  "CREATOR_CRM_FILTER_ENABLED",
  "NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED",
] as const;

const snapshot: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
});

function clearFlagEnv() {
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key];
    delete process.env[key];
  }
}

test("isCreatorCrmFilterEnabled defaults to false (Phase 1 / production-safe)", () => {
  clearFlagEnv();
  assert.equal(isCreatorCrmFilterEnabled(), false);
});

test("isCreatorCrmFilterEnabled treats empty and falsey strings as OFF", () => {
  clearFlagEnv();
  process.env.CREATOR_CRM_FILTER_ENABLED = "false";
  assert.equal(isCreatorCrmFilterEnabled(), false);
  process.env.CREATOR_CRM_FILTER_ENABLED = "0";
  assert.equal(isCreatorCrmFilterEnabled(), false);
  process.env.CREATOR_CRM_FILTER_ENABLED = "";
  assert.equal(isCreatorCrmFilterEnabled(), false);
});

test("isCreatorCrmFilterEnabled enables only on explicit true-like values", () => {
  clearFlagEnv();
  process.env.CREATOR_CRM_FILTER_ENABLED = "true";
  assert.equal(isCreatorCrmFilterEnabled(), true);
  process.env.CREATOR_CRM_FILTER_ENABLED = "1";
  assert.equal(isCreatorCrmFilterEnabled(), true);
  process.env.NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED = "yes";
  delete process.env.CREATOR_CRM_FILTER_ENABLED;
  assert.equal(isCreatorCrmFilterEnabled(), true);
});
