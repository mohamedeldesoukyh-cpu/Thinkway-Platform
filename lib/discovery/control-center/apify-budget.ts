/**
 * Fail-closed Apify acquisition budget protection.
 *
 * Rules:
 * - A budget of 0, negative, NaN, null, or undefined rejects ALL Apify acquisition.
 * - Both maxRequestsPerDay and maxCreditsPerDay must be positive finite numbers.
 * - 0 is NEVER treated as unlimited.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCachedDiscoveryControlSettings,
  loadDiscoveryControlSettings,
  type DiscoveryControlCostProtectionProvenance,
} from "./discovery-control-service";
import type { DiscoveryControlSettings, DiscoveryCostProtection } from "./discovery-control-types";

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read daily usage fail-closed: query errors reject acquisition.
 * Missing row is treated as zero usage (budget still enforced).
 */
async function readDailyUsageOrThrow(
  supabase: SupabaseClient
): Promise<{ requestCount: number; creditsUsed: number }> {
  const usageDate = todayUtcDate();
  const { data, error } = await supabase
    .from("discovery_apify_usage")
    .select("request_count, credits_used")
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "discovery_apify_usage query failed");
  }

  return {
    requestCount: Number(data?.request_count ?? 0),
    creditsUsed: Number(data?.credits_used ?? 0),
  };
}

export const APIFY_BUDGET_NOT_CONFIGURED_REASON =
  "Apify acquisition rejected — daily budget is 0 or unset (fail-closed). Set positive maxRequestsPerDay and maxCreditsPerDay in Discovery Control Center.";

export const APIFY_BUDGET_UNVERIFIED_REASON =
  "Apify acquisition rejected — daily budget usage could not be verified (fail-closed).";

export type ApifyBudgetCaps = {
  maxRequestsPerDay: number | null;
  maxCreditsPerDay: number | null;
};

export type ApifyBudgetDecision = {
  allowed: boolean;
  reason: string;
  code:
    | "ok"
    | "budget_not_configured"
    | "requests_exhausted"
    | "credits_exhausted"
    | "usage_unverified";
  caps: ApifyBudgetCaps;
  usage?: { requestCount: number; creditsUsed: number };
};

export type ApifyBudgetRejectMeta = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Normalize a single budget dimension. Positive finite → value; otherwise null (closed). */
export function normalizeApifyBudgetCap(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Resolve request/credit caps from cost protection.
 * Any missing or non-positive cap is null — never "unlimited".
 */
export function resolveApifyBudgetCaps(
  costProtection?: Partial<DiscoveryCostProtection> | null
): ApifyBudgetCaps {
  return {
    maxRequestsPerDay: normalizeApifyBudgetCap(costProtection?.maxRequestsPerDay),
    maxCreditsPerDay: normalizeApifyBudgetCap(costProtection?.maxCreditsPerDay),
  };
}

/** True only when both daily caps are configured as positive numbers. */
export function areApifyBudgetCapsConfigured(caps: ApifyBudgetCaps): boolean {
  return caps.maxRequestsPerDay != null && caps.maxCreditsPerDay != null;
}

/** Structured log for every Apify budget rejection. */
export function logApifyBudgetRejection(
  source: string,
  decision: Pick<ApifyBudgetDecision, "reason" | "code" | "caps" | "usage">,
  meta?: ApifyBudgetRejectMeta
): void {
  console.warn(
    "[apify-budget] rejected",
    JSON.stringify({
      source,
      code: decision.code,
      reason: decision.reason,
      maxRequestsPerDay: decision.caps.maxRequestsPerDay,
      maxCreditsPerDay: decision.caps.maxCreditsPerDay,
      requestCount: decision.usage?.requestCount ?? null,
      creditsUsed: decision.usage?.creditsUsed ?? null,
      ...(meta ?? {}),
    })
  );
}

/**
 * Evaluate configured caps only (no I/O). Rejects when either budget is 0/undefined.
 */
export function evaluateApifyBudgetConfiguration(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): ApifyBudgetDecision {
  const caps = resolveApifyBudgetCaps(settings.costProtection);
  if (!areApifyBudgetCapsConfigured(caps)) {
    return {
      allowed: false,
      reason: APIFY_BUDGET_NOT_CONFIGURED_REASON,
      code: "budget_not_configured",
      caps,
    };
  }
  return {
    allowed: true,
    reason: "Apify daily budgets are configured.",
    code: "ok",
    caps,
  };
}

function logApifyBudgetDecisionInputs(
  source: string,
  settings: DiscoveryControlSettings,
  provenance: DiscoveryControlCostProtectionProvenance | null,
  caps: ApifyBudgetCaps,
  meta?: ApifyBudgetRejectMeta
): void {
  console.log(
    "[apify-budget] before_decision",
    JSON.stringify({
      source,
      // Exact sources for each cap (database row vs DISCOVERY_APIFY_MAX_* env).
      provenance: provenance
        ? {
            loadedFrom: provenance.loadedFrom,
            maxRequestsPerDay: provenance.maxRequestsPerDay,
            maxCreditsPerDay: provenance.maxCreditsPerDay,
          }
        : null,
      mergedCostProtection: settings.costProtection,
      resolvedCaps: caps,
      // normalizeApifyBudgetCap turns 0 → null; null fails closed.
      willFailClosed: !areApifyBudgetCapsConfigured(caps),
      ...(meta ?? {}),
    })
  );
}

/**
 * Full fail-closed budget gate: configured caps + current daily usage.
 * Logs every rejection with structured JSON.
 */
export async function assertApifyAcquisitionBudget(
  supabase: SupabaseClient | null | undefined,
  options?: {
    settings?: DiscoveryControlSettings;
    source?: string;
    meta?: ApifyBudgetRejectMeta;
  }
): Promise<ApifyBudgetDecision> {
  const source = options?.source ?? "apify_acquisition";
  let settings = options?.settings;
  let provenance: DiscoveryControlCostProtectionProvenance | null = null;

  if (!settings) {
    const loaded = await loadDiscoveryControlSettings(supabase ?? undefined);
    settings = loaded.settings;
    provenance = loaded.provenance;
  }

  const caps = resolveApifyBudgetCaps(settings.costProtection);
  logApifyBudgetDecisionInputs(source, settings, provenance, caps, options?.meta);

  const configured = evaluateApifyBudgetConfiguration(settings);
  if (!configured.allowed) {
    logApifyBudgetRejection(source, configured, {
      ...(options?.meta ?? {}),
      requestsSource: provenance?.maxRequestsPerDay.source ?? null,
      creditsSource: provenance?.maxCreditsPerDay.source ?? null,
      databaseRequestsRaw: provenance?.maxRequestsPerDay.databaseRaw ?? null,
      databaseCreditsRaw: provenance?.maxCreditsPerDay.databaseRaw ?? null,
      envRequestsRaw: provenance?.maxRequestsPerDay.envRaw ?? null,
      envCreditsRaw: provenance?.maxCreditsPerDay.envRaw ?? null,
      envRequestsParsed: provenance?.maxRequestsPerDay.envParsed ?? null,
      envCreditsParsed: provenance?.maxCreditsPerDay.envParsed ?? null,
      effectiveRequests: provenance?.maxRequestsPerDay.effective ?? settings.costProtection.maxRequestsPerDay,
      effectiveCredits: provenance?.maxCreditsPerDay.effective ?? settings.costProtection.maxCreditsPerDay,
    });
    return configured;
  }

  if (!supabase) {
    const unverified: ApifyBudgetDecision = {
      allowed: false,
      reason: APIFY_BUDGET_UNVERIFIED_REASON,
      code: "usage_unverified",
      caps: configured.caps,
    };
    logApifyBudgetRejection(source, unverified, options?.meta);
    return unverified;
  }

  let usage: { requestCount: number; creditsUsed: number };
  try {
    usage = await readDailyUsageOrThrow(supabase);
  } catch {
    const unverified: ApifyBudgetDecision = {
      allowed: false,
      reason: APIFY_BUDGET_UNVERIFIED_REASON,
      code: "usage_unverified",
      caps: configured.caps,
    };
    logApifyBudgetRejection(source, unverified, options?.meta);
    return unverified;
  }

  const maxRequests = configured.caps.maxRequestsPerDay as number;
  const maxCredits = configured.caps.maxCreditsPerDay as number;

  if (usage.requestCount >= maxRequests) {
    const decision: ApifyBudgetDecision = {
      allowed: false,
      reason: `Daily Apify request limit reached (${usage.requestCount}/${maxRequests}).`,
      code: "requests_exhausted",
      caps: configured.caps,
      usage,
    };
    logApifyBudgetRejection(source, decision, options?.meta);
    return decision;
  }

  if (usage.creditsUsed >= maxCredits) {
    const decision: ApifyBudgetDecision = {
      allowed: false,
      reason: `Daily Apify credit limit reached (${usage.creditsUsed}/${maxCredits}).`,
      code: "credits_exhausted",
      caps: configured.caps,
      usage,
    };
    logApifyBudgetRejection(source, decision, options?.meta);
    return decision;
  }

  return {
    allowed: true,
    reason: "Apify acquisition within daily budget.",
    code: "ok",
    caps: configured.caps,
    usage,
  };
}
