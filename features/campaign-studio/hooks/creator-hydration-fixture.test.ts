import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveFixtureCreatorDetail,
  resolveFixtureHydratedVendors,
} from "./creator-hydration-fixture";

const FIXTURE_VENDORS = [
  { id: "00000000-0000-4000-8000-000000000011", displayName: "Nour Star", handle: "@nour", platform: "instagram" },
  { id: "00000000-0000-4000-8000-000000000012", displayName: "Layla Macro", handle: "@layla", platform: "tiktok" },
];

test("fixture hydration provides deterministic cards without a persisted creator record", () => {
  const resolved = resolveFixtureHydratedVendors(
    [FIXTURE_VENDORS[1].id, `inf:${FIXTURE_VENDORS[0].id}`],
    FIXTURE_VENDORS
  );

  assert.deepEqual(resolved.map((vendor) => vendor.displayName), ["Layla Macro", "Nour Star"]);
});

test("fixture detail adapter opens the canonical detail pack without a database record", () => {
  const detail = resolveFixtureCreatorDetail(FIXTURE_VENDORS[0].id, FIXTURE_VENDORS);

  assert.equal(detail?.display_name, "Nour Star");
  assert.equal(detail?.platforms[0]?.handle, "nour");
  assert.equal(detail?.rate_card, undefined);
});
