import assert from "node:assert/strict";

import {
  isDemoDataEnabled,
  isMockSeedUsername,
  isSyntheticCreatorUsername,
  MOCK_SEED_USERNAME_RE,
  stripSyntheticCreators,
} from "@/lib/discovery/demo-data";

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

assert.equal(isDemoDataEnabled(env({ NODE_ENV: "development" })), false);
assert.equal(isDemoDataEnabled(env({ NODE_ENV: "production" })), false);
assert.equal(isDemoDataEnabled(env({ NODE_ENV: "test" })), false);
assert.equal(
  isDemoDataEnabled(env({ NODE_ENV: "development", ENABLE_DEMO_DATA: "true" })),
  false
);
assert.equal(
  isDemoDataEnabled(env({ NODE_ENV: "production", ENABLE_DEMO_DATA: "true" })),
  false
);
assert.equal(
  isDemoDataEnabled(env({ NODE_ENV: "test", ENABLE_DEMO_DATA: "false" })),
  false
);

assert.equal(isMockSeedUsername("tw_beauty_ae_01"), true);
assert.equal(isMockSeedUsername("thinkway_test_creator"), false);
assert.equal(isMockSeedUsername("razanejammal"), false);
assert.match("tw_food_ae_11", MOCK_SEED_USERNAME_RE);

// Synthetic prefix guard — bulletproof across all generator prefixes (item 9).
for (const u of [
  "tw_food_ae_11",
  "demo_creator",
  "mock_user_1",
  "seed_influencer",
  "fake_account",
  "TW_BEAUTY_AE_01",
  "DEMO_x",
]) {
  assert.equal(isSyntheticCreatorUsername(u), true, `${u} should be synthetic`);
}
for (const u of [
  "razanejammal",
  "thinkway_official",
  "townsquare",
  "seeded_real_name",
  "",
  null,
  undefined,
]) {
  assert.equal(
    isSyntheticCreatorUsername(u),
    false,
    `${String(u)} should NOT be synthetic`
  );
}

// Zero real results stays empty; synthetic rows are always stripped (item 9).
assert.deepEqual(stripSyntheticCreators([]), []);
assert.deepEqual(
  stripSyntheticCreators([
    { username: "tw_food_ae_11" },
    { username: "demo_creator" },
    { username: "mock_user" },
    { username: "seed_x" },
    { username: "fake_y" },
  ]),
  []
);
assert.deepEqual(
  stripSyntheticCreators([
    { username: "razanejammal" },
    { username: "demo_creator" },
  ]),
  [{ username: "razanejammal" }]
);

console.log("demo-data.test.ts: all assertions passed");
