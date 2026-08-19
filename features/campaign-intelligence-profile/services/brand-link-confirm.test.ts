import assert from "node:assert/strict";
import { test } from "node:test";

import { brandLinkConfirmReady } from "./brand-link-confirm";

test("Create new and Link existing still require a Thinkway brand", () => {
  assert.equal(
    brandLinkConfirmReady({ intent: "create", selectedBrandId: "" }),
    false
  );
  assert.equal(
    brandLinkConfirmReady({ intent: "create", selectedBrandId: "brand-1" }),
    true
  );
  assert.equal(
    brandLinkConfirmReady({
      intent: "link",
      selectedBrandId: "brand-1",
      linkProfileId: "",
    }),
    false
  );
  assert.equal(
    brandLinkConfirmReady({
      intent: "link",
      selectedBrandId: "brand-1",
      linkProfileId: "cip-1",
    }),
    true
  );
});

test("a new-client brief can continue without picking from the brand list", () => {
  assert.equal(
    brandLinkConfirmReady({
      intent: "continue_without_brand",
      selectedBrandId: "",
    }),
    true
  );
});
