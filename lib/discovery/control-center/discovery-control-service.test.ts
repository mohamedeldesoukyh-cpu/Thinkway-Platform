import assert from "node:assert/strict";

import {
  mergeWithDefaults,
  resolveCostProtectionCap,
} from "./discovery-control-service";

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function testResolveCostProtectionCap() {
  assert.deepEqual(resolveCostProtectionCap(0, 50), {
    effective: 50,
    source: "env",
  });
  assert.deepEqual(resolveCostProtectionCap(null, 50), {
    effective: 50,
    source: "env",
  });
  assert.deepEqual(resolveCostProtectionCap(25, 50), {
    effective: 25,
    source: "database",
  });
  assert.deepEqual(resolveCostProtectionCap(0, 0), {
    effective: 0,
    source: "unset",
  });
}

function testDbZeroFallsThroughToEnv() {
  withEnv(
    {
      DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY: "50",
      DISCOVERY_APIFY_MAX_CREDITS_PER_DAY: "50",
    },
    () => {
      const { settings, provenance } = mergeWithDefaults({
        costProtection: {
          maxRequestsPerDay: 0,
          maxCreditsPerDay: 0,
          confirmBeforeExceed: false,
        },
      });

      assert.equal(settings.costProtection.maxRequestsPerDay, 50);
      assert.equal(settings.costProtection.maxCreditsPerDay, 50);
      assert.equal(provenance.maxRequestsPerDay.source, "env");
      assert.equal(provenance.maxCreditsPerDay.source, "env");
      assert.equal(provenance.maxRequestsPerDay.databaseRaw, 0);
      assert.equal(provenance.maxRequestsPerDay.envParsed, 50);
    }
  );
}

function testPositiveDbWinsOverEnv() {
  withEnv(
    {
      DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY: "50",
      DISCOVERY_APIFY_MAX_CREDITS_PER_DAY: "50",
    },
    () => {
      const { settings, provenance } = mergeWithDefaults({
        costProtection: {
          maxRequestsPerDay: 10,
          maxCreditsPerDay: 12,
          confirmBeforeExceed: false,
        },
      });

      assert.equal(settings.costProtection.maxRequestsPerDay, 10);
      assert.equal(settings.costProtection.maxCreditsPerDay, 12);
      assert.equal(provenance.maxRequestsPerDay.source, "database");
      assert.equal(provenance.maxCreditsPerDay.source, "database");
    }
  );
}

function run() {
  testResolveCostProtectionCap();
  testDbZeroFallsThroughToEnv();
  testPositiveDbWinsOverEnv();
  console.log(
    "lib/discovery/control-center/discovery-control-service.test.ts — all tests passed"
  );
}

run();
