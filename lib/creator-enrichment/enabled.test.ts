import assert from "node:assert/strict";

import {
  canEnqueueCreatorEnrichment,
  isCreatorEnrichmentMasterDisabled,
  isCreatorEnrichmentWorkerEnabled,
  isManualEnrichmentAllowed,
} from "./enabled";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void
): void {
  const keys = Object.keys(patch);
  const prior: Record<string, string | undefined> = {};
  for (const key of keys) {
    prior[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      const value = prior[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function testManualAllowedByDefault() {
  withEnv(
    {
      DISABLE_CREATOR_ENRICHMENT: undefined,
      ALLOW_MANUAL_ENRICHMENT: undefined,
      AUTO_CREATOR_ENRICHMENT: undefined,
    },
    () => {
      assert.equal(isCreatorEnrichmentMasterDisabled(), false);
      assert.equal(isManualEnrichmentAllowed(), true);
      assert.equal(isCreatorEnrichmentWorkerEnabled(), true);
      const gate = canEnqueueCreatorEnrichment({ trigger: "manual", scope: "metrics" });
      assert.equal(gate.allowed, true);
    }
  );
}

function testMasterKillDisablesAll() {
  withEnv({ DISABLE_CREATOR_ENRICHMENT: "true" }, () => {
    assert.equal(isCreatorEnrichmentMasterDisabled(), true);
    assert.equal(isCreatorEnrichmentWorkerEnabled(), false);
    const gate = canEnqueueCreatorEnrichment({ trigger: "manual", scope: "metrics" });
    assert.equal(gate.allowed, false);
  });
}

function testAutoTriggersBlockedByDefault() {
  withEnv(
    {
      DISABLE_CREATOR_ENRICHMENT: undefined,
      AUTO_CREATOR_ENRICHMENT: undefined,
    },
    () => {
      const gate = canEnqueueCreatorEnrichment({ trigger: "shortlist", scope: "all" });
      assert.equal(gate.allowed, false);
    }
  );
}

function testOperationalSafetyKillSwitchBlocksAutoOnly() {
  withEnv(
    {
      DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION: "true",
      DISABLE_CREATOR_ENRICHMENT: undefined,
      ALLOW_MANUAL_ENRICHMENT: "true",
      AUTO_CREATOR_ENRICHMENT: "true",
    },
    () => {
      assert.equal(canEnqueueCreatorEnrichment({ trigger: "detail", scope: "all" }).allowed, false);
      assert.equal(canEnqueueCreatorEnrichment({ trigger: "campaign", scope: "all" }).allowed, false);
      assert.equal(canEnqueueCreatorEnrichment({ trigger: "stale", scope: "all" }).allowed, false);
      assert.equal(canEnqueueCreatorEnrichment({ trigger: "manual", scope: "all" }).allowed, true);
    }
  );
}

function run() {
  testManualAllowedByDefault();
  testMasterKillDisablesAll();
  testAutoTriggersBlockedByDefault();
  testOperationalSafetyKillSwitchBlocksAutoOnly();
  console.log("lib/creator-enrichment/enabled.test.ts — all tests passed");
}

run();
