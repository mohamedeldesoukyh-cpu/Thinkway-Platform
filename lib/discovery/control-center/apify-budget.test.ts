import assert from "node:assert/strict";

import {
  APIFY_BUDGET_NOT_CONFIGURED_REASON,
  APIFY_BUDGET_UNVERIFIED_REASON,
  areApifyBudgetCapsConfigured,
  assertApifyAcquisitionBudget,
  evaluateApifyBudgetConfiguration,
  normalizeApifyBudgetCap,
  resolveApifyBudgetCaps,
  selectApifyBudgetClient,
} from "./apify-budget";
import type { DiscoveryControlSettings } from "./discovery-control-types";

function settingsWithBudget(
  maxRequestsPerDay: number,
  maxCreditsPerDay: number
): DiscoveryControlSettings {
  return {
    discoverySource: "hybrid",
    searchPriority: "database_first",
    coverageThreshold: 80,
    automaticEnrichment: "never",
    dataFreshnessDays: null,
    dnaPolicy: {
      generateAfterImport: true,
      updateAfterEnrichment: true,
      calculateCompleteness: true,
    },
    costProtection: {
      maxRequestsPerDay,
      maxCreditsPerDay,
      confirmBeforeExceed: false,
    },
  };
}

function testNormalizeRejectsZeroAndUndefined() {
  assert.equal(normalizeApifyBudgetCap(0), null);
  assert.equal(normalizeApifyBudgetCap(-1), null);
  assert.equal(normalizeApifyBudgetCap(undefined), null);
  assert.equal(normalizeApifyBudgetCap(null), null);
  assert.equal(normalizeApifyBudgetCap(Number.NaN), null);
  assert.equal(normalizeApifyBudgetCap("0"), null);
  assert.equal(normalizeApifyBudgetCap(10), 10);
  assert.equal(normalizeApifyBudgetCap("25.5"), 25.5);
}

function testZeroIsNeverUnlimited() {
  const bothZero = resolveApifyBudgetCaps({
    maxRequestsPerDay: 0,
    maxCreditsPerDay: 0,
  });
  assert.equal(areApifyBudgetCapsConfigured(bothZero), false);

  const requestsOnly = resolveApifyBudgetCaps({
    maxRequestsPerDay: 100,
    maxCreditsPerDay: 0,
  });
  assert.equal(areApifyBudgetCapsConfigured(requestsOnly), false);
  assert.equal(requestsOnly.maxCreditsPerDay, null);

  const creditsOnly = resolveApifyBudgetCaps({
    maxRequestsPerDay: 0,
    maxCreditsPerDay: 50,
  });
  assert.equal(areApifyBudgetCapsConfigured(creditsOnly), false);
  assert.equal(creditsOnly.maxRequestsPerDay, null);

  const bothPositive = resolveApifyBudgetCaps({
    maxRequestsPerDay: 100,
    maxCreditsPerDay: 50,
  });
  assert.equal(areApifyBudgetCapsConfigured(bothPositive), true);
}

function testEvaluateConfigurationFailClosed() {
  const rejected = evaluateApifyBudgetConfiguration(settingsWithBudget(0, 0));
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.code, "budget_not_configured");
  assert.equal(rejected.reason, APIFY_BUDGET_NOT_CONFIGURED_REASON);

  const unset = evaluateApifyBudgetConfiguration({
    ...settingsWithBudget(10, 10),
    costProtection: {
      maxRequestsPerDay: undefined as unknown as number,
      maxCreditsPerDay: undefined as unknown as number,
      confirmBeforeExceed: false,
    },
  });
  assert.equal(unset.allowed, false);
  assert.equal(unset.code, "budget_not_configured");

  const ok = evaluateApifyBudgetConfiguration(settingsWithBudget(100, 25));
  assert.equal(ok.allowed, true);
  assert.equal(ok.code, "ok");
}

async function testAssertWithoutSupabaseFailsClosed() {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    const decision = await assertApifyAcquisitionBudget(null, {
      settings: settingsWithBudget(100, 25),
      source: "unit_test_unverified",
      meta: {
        clientResolutionReason: "SUPABASE_SERVICE_ROLE_KEY is required for service-role operations.",
      },
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "usage_unverified");
    assert.ok(decision.reason.startsWith(APIFY_BUDGET_UNVERIFIED_REASON));
    assert.match(decision.reason, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /\[apify-budget\] rejected/);
    assert.match(warnings[0]!, /usage_unverified/);
  } finally {
    console.warn = original;
  }
}

async function testAssertZeroBudgetLogsRejection() {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    const decision = await assertApifyAcquisitionBudget(null, {
      settings: settingsWithBudget(0, 0),
      source: "unit_test_zero_budget",
      meta: { searchId: "s1" },
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "budget_not_configured");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /budget_not_configured/);
    assert.match(warnings[0]!, /searchId/);
  } finally {
    console.warn = original;
  }
}

async function testAssertUsageExhausted() {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };

  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: {
                    usage_date: "2026-07-23",
                    request_count: 100,
                    credits_used: 1,
                  },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  } as never;

  try {
    const decision = await assertApifyAcquisitionBudget(supabase, {
      settings: settingsWithBudget(100, 50),
      source: "unit_test_requests_exhausted",
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "requests_exhausted");
    assert.match(decision.reason, /request limit reached/);
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = original;
  }
}

function testSelectApifyBudgetClientPrefersServiceRole() {
  const serviceRole = { kind: "service_role" };
  const userJwt = { kind: "user_jwt" };

  const preferred = selectApifyBudgetClient({
    serviceRoleClient: serviceRole,
    serviceRoleReason: null,
    preferredClient: userJwt,
  });
  assert.equal(preferred.client, serviceRole);
  assert.equal(preferred.reason, "service_role");

  const fallback = selectApifyBudgetClient({
    serviceRoleClient: null,
    serviceRoleReason: "SUPABASE_SERVICE_ROLE_KEY is required for service-role operations.",
    preferredClient: userJwt,
  });
  assert.equal(fallback.client, userJwt);
  assert.match(fallback.reason ?? "", /preferred_fallback/);

  const none = selectApifyBudgetClient({
    serviceRoleClient: null,
    serviceRoleReason: "service_role_client_unavailable",
    preferredClient: null,
  });
  assert.equal(none.client, null);
  assert.equal(none.reason, "service_role_client_unavailable");
}

async function run() {
  testNormalizeRejectsZeroAndUndefined();
  testZeroIsNeverUnlimited();
  testEvaluateConfigurationFailClosed();
  testSelectApifyBudgetClientPrefersServiceRole();
  await testAssertWithoutSupabaseFailsClosed();
  await testAssertZeroBudgetLogsRejection();
  await testAssertUsageExhausted();
  console.log("lib/discovery/control-center/apify-budget.test.ts — all tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
