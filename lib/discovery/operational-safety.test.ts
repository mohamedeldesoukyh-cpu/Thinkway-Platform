import assert from "node:assert/strict";

import {
  AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
  DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION_ENV,
  isAutomaticEnrichmentAndAcquisitionDisabled,
  logBlockedAutomaticAction,
} from "./operational-safety";
import {
  applyPolicyToBrowse,
  isApifyLiveOnly,
  isPlatformDatabaseOnly,
  shouldAutoEnrichForTrigger,
  shouldCallApify,
  shouldSkipDatabaseBrowse,
} from "./control-center/discovery-control-policy";
import type { DiscoveryControlSettings } from "./control-center/discovery-control-types";
import { canEnqueueCreatorEnrichment } from "@/lib/creator-enrichment/enabled";

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

const hybridSettings: DiscoveryControlSettings = {
  discoverySource: "hybrid",
  searchPriority: "database_first",
  automaticEnrichment: "always",
  coverageThreshold: 0.5,
  dataFreshnessDays: 30,
  costProtection: {
    maxRequestsPerDay: 0,
    maxCreditsPerDay: 0,
    confirmBeforeExceed: false,
  },
  dnaPolicy: {
    generateAfterImport: false,
    updateAfterEnrichment: false,
    calculateCompleteness: false,
  },
};

function testDefaultsFailClosed() {
  withEnv({ [DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION_ENV]: undefined }, () => {
    assert.equal(isAutomaticEnrichmentAndAcquisitionDisabled(), true);
  });
}

function testExplicitEnable() {
  withEnv({ [DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION_ENV]: "false" }, () => {
    assert.equal(isAutomaticEnrichmentAndAcquisitionDisabled(), false);
  });
}

function testBrowseForcedDbOnly() {
  withEnv({ [DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION_ENV]: "true" }, () => {
    assert.equal(isPlatformDatabaseOnly(hybridSettings), true);
    assert.equal(isApifyLiveOnly(hybridSettings), false);
    assert.equal(shouldSkipDatabaseBrowse(hybridSettings), false);
    assert.equal(shouldCallApify(hybridSettings, { creatorCount: 0 }), false);

    const filtered = applyPolicyToBrowse(
      { source: "all", page: 1, pageSize: 20 },
      hybridSettings
    );
    assert.equal(filtered.source, "internal");
    assert.equal(filtered.skipCoverageBackfill, true);
  });
}

function testAutoEnrichBlockedManualAllowed() {
  withEnv(
    {
      [DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION_ENV]: "true",
      DISABLE_CREATOR_ENRICHMENT: undefined,
      ALLOW_MANUAL_ENRICHMENT: "true",
      AUTO_CREATOR_ENRICHMENT: "true",
    },
    () => {
      assert.equal(shouldAutoEnrichForTrigger("shortlist", hybridSettings), false);
      assert.equal(canEnqueueCreatorEnrichment({ trigger: "shortlist" }).allowed, false);
      assert.equal(
        canEnqueueCreatorEnrichment({ trigger: "shortlist" }).reason,
        AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON
      );
      assert.equal(canEnqueueCreatorEnrichment({ trigger: "manual", scope: "metrics" }).allowed, true);
    }
  );
}

function testBlockedActionLogs() {
  withEnv({ [DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION_ENV]: "true" }, () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      logBlockedAutomaticAction("unit_test_action", AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON, {
        searchId: "s1",
      });
    } finally {
      console.warn = original;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /\[operational-safety\] blocked unit_test_action/);
    assert.match(warnings[0]!, /searchId/);
  });
}

function run() {
  testDefaultsFailClosed();
  testExplicitEnable();
  testBrowseForcedDbOnly();
  testAutoEnrichBlockedManualAllowed();
  testBlockedActionLogs();
  console.log("lib/discovery/operational-safety.test.ts — all tests passed");
}

run();
