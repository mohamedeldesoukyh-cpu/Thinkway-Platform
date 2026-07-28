import assert from "node:assert/strict";
import { test } from "node:test";

import { isRelease20AssignmentConvertEnabled } from "./release-2-0-feature-flag";

test("Release 2.0 Assignment convert is OFF by default; explicit env overrides", () => {
  const previous = process.env.RELEASE_2_0_ASSIGNMENT_CONVERT;
  const previousPublic = process.env.NEXT_PUBLIC_RELEASE_2_0_ASSIGNMENT_CONVERT;
  const previousEnv = process.env.NEXT_PUBLIC_THINKWAY_ENV;

  delete process.env.RELEASE_2_0_ASSIGNMENT_CONVERT;
  delete process.env.NEXT_PUBLIC_RELEASE_2_0_ASSIGNMENT_CONVERT;

  process.env.NEXT_PUBLIC_THINKWAY_ENV = "production";
  assert.equal(isRelease20AssignmentConvertEnabled(), false);

  process.env.NEXT_PUBLIC_THINKWAY_ENV = "development";
  assert.equal(isRelease20AssignmentConvertEnabled(), false);

  process.env.RELEASE_2_0_ASSIGNMENT_CONVERT = "false";
  assert.equal(isRelease20AssignmentConvertEnabled(), false);

  process.env.RELEASE_2_0_ASSIGNMENT_CONVERT = "true";
  assert.equal(isRelease20AssignmentConvertEnabled(), true);

  delete process.env.RELEASE_2_0_ASSIGNMENT_CONVERT;
  process.env.NEXT_PUBLIC_RELEASE_2_0_ASSIGNMENT_CONVERT = "on";
  assert.equal(isRelease20AssignmentConvertEnabled(), true);

  if (previous === undefined) delete process.env.RELEASE_2_0_ASSIGNMENT_CONVERT;
  else process.env.RELEASE_2_0_ASSIGNMENT_CONVERT = previous;
  if (previousPublic === undefined) {
    delete process.env.NEXT_PUBLIC_RELEASE_2_0_ASSIGNMENT_CONVERT;
  } else {
    process.env.NEXT_PUBLIC_RELEASE_2_0_ASSIGNMENT_CONVERT = previousPublic;
  }
  if (previousEnv === undefined) delete process.env.NEXT_PUBLIC_THINKWAY_ENV;
  else process.env.NEXT_PUBLIC_THINKWAY_ENV = previousEnv;
});
