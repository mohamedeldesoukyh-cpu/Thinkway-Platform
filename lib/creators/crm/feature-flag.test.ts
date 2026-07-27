import assert from "node:assert/strict";
import test from "node:test";

import {
  isCreatorCrmFilterEnabled,
  isCreatorCrmWritersEnabled,
} from "./feature-flag";

const KEYS = [
  "CREATOR_CRM_WRITERS_ENABLED",
  "CREATOR_CRM_FILTER_ENABLED",
  "NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED",
] as const;

function clearFlags() {
  for (const key of KEYS) delete process.env[key];
}

test("writers default ON when unset (Commercial CRM completion)", () => {
  clearFlags();
  assert.equal(isCreatorCrmWritersEnabled(), true);
});

test("writers OFF only on explicit falsey values", () => {
  clearFlags();
  process.env.CREATOR_CRM_WRITERS_ENABLED = "false";
  assert.equal(isCreatorCrmWritersEnabled(), false);
  process.env.CREATOR_CRM_WRITERS_ENABLED = "0";
  assert.equal(isCreatorCrmWritersEnabled(), false);
  process.env.CREATOR_CRM_WRITERS_ENABLED = "off";
  assert.equal(isCreatorCrmWritersEnabled(), false);
});

test("writers ON for true-like and other non-disabled values", () => {
  clearFlags();
  process.env.CREATOR_CRM_WRITERS_ENABLED = "true";
  assert.equal(isCreatorCrmWritersEnabled(), true);
  process.env.CREATOR_CRM_WRITERS_ENABLED = "1";
  assert.equal(isCreatorCrmWritersEnabled(), true);
});

test("filter defaults ON when unset", () => {
  clearFlags();
  assert.equal(isCreatorCrmFilterEnabled(), true);
});

test("filter OFF on explicit false", () => {
  clearFlags();
  process.env.CREATOR_CRM_FILTER_ENABLED = "false";
  assert.equal(isCreatorCrmFilterEnabled(), false);
  delete process.env.CREATOR_CRM_FILTER_ENABLED;
  process.env.NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED = "off";
  assert.equal(isCreatorCrmFilterEnabled(), false);
});
