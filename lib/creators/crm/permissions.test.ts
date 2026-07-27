import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canConvertToCommercialCreator,
  isManualCrmActivationReason,
} from "./permissions";

test("canConvertToCommercialCreator allows AM, Ops, Admin, Super Admin", () => {
  assert.equal(canConvertToCommercialCreator("account_manager"), true);
  assert.equal(canConvertToCommercialCreator("operations"), true);
  assert.equal(canConvertToCommercialCreator("admin"), true);
  assert.equal(canConvertToCommercialCreator("super_admin"), true);
});

test("canConvertToCommercialCreator denies finance and other roles", () => {
  assert.equal(canConvertToCommercialCreator("finance"), false);
  assert.equal(canConvertToCommercialCreator("director"), false);
  assert.equal(canConvertToCommercialCreator("data_entry"), false);
  assert.equal(canConvertToCommercialCreator(null), false);
  assert.equal(canConvertToCommercialCreator(undefined), false);
});

test("isManualCrmActivationReason only matches convert/create", () => {
  assert.equal(isManualCrmActivationReason("manual_convert"), true);
  assert.equal(isManualCrmActivationReason("manual_create"), true);
  assert.equal(isManualCrmActivationReason("campaign_assignment"), false);
  assert.equal(isManualCrmActivationReason("vendor_io"), false);
});
