/**
 * Granular gates for creator enrichment (import vs manual vs auto).
 *
 * Import and enrichment are fully separate. Automatic enrichment is off by default;
 * manual refresh is on by default when not master-killed.
 *
 * `DISABLE_CREATOR_ENRICHMENT=true` — master kill (disables ALL enrichment).
 * `APIFY_ENRICHMENT_ENABLED` — deprecated; ignored by application logic.
 */

import type { EnrichmentTrigger } from "./types";
import { shouldAutoEnrichForTrigger } from "@/lib/discovery/control-center/discovery-control-policy";
import { getCachedDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";

export type EnrichmentScope =
  | "avatar"
  | "metrics"
  | "profile"
  | "audience"
  | "categories"
  | "all";

const TRUTHY = new Set(["true", "1", "yes", "on"]);
const FALSY = new Set(["false", "0", "no", "off"]);

function envFlag(name: string): string | undefined {
  return process.env[name]?.trim().toLowerCase();
}

function envTruthy(name: string, defaultValue: boolean): boolean {
  const value = envFlag(name);
  if (value === undefined || value === "") return defaultValue;
  if (TRUTHY.has(value)) return true;
  if (FALSY.has(value)) return false;
  return defaultValue;
}

/** Master kill — disables every enrichment pathway. */
export function isCreatorEnrichmentMasterDisabled(): boolean {
  return envTruthy("DISABLE_CREATOR_ENRICHMENT", false);
}

export function isAutoImportEnrichmentEnabled(): boolean {
  return envTruthy("AUTO_IMPORT_ENRICHMENT", false);
}

export function isAutoCreatorEnrichmentEnabled(): boolean {
  return envTruthy("AUTO_CREATOR_ENRICHMENT", false);
}

export function isManualEnrichmentAllowed(): boolean {
  return envTruthy("ALLOW_MANUAL_ENRICHMENT", true);
}

export function isBulkEnrichmentAllowed(): boolean {
  return envTruthy("ALLOW_BULK_ENRICHMENT", true);
}

export function isScopeRefreshAllowed(scope: EnrichmentScope): boolean {
  if (scope === "all") {
    return (
      isScopeRefreshAllowed("avatar") &&
      isScopeRefreshAllowed("metrics") &&
      isScopeRefreshAllowed("profile") &&
      isScopeRefreshAllowed("audience") &&
      isScopeRefreshAllowed("categories")
    );
  }

  const flagByScope: Record<Exclude<EnrichmentScope, "all">, string> = {
    avatar: "ALLOW_AVATAR_REFRESH",
    metrics: "ALLOW_METRICS_REFRESH",
    profile: "ALLOW_PROFILE_REFRESH",
    audience: "ALLOW_AUDIENCE_REFRESH",
    categories: "ALLOW_CATEGORY_REFRESH",
  };

  return envTruthy(flagByScope[scope], true);
}

const AUTO_TRIGGERS = new Set<EnrichmentTrigger>([
  "detail",
  "shortlist",
  "campaign",
  "stale",
]);

/** True when the discovery worker should start the creator-enrichment queue consumer. */
export function isCreatorEnrichmentWorkerEnabled(): boolean {
  if (isCreatorEnrichmentMasterDisabled()) return false;
  return (
    isManualEnrichmentAllowed() ||
    isAutoCreatorEnrichmentEnabled() ||
    isAutoImportEnrichmentEnabled()
  );
}

/**
 * Legacy aggregate gate — true when enrichment jobs may be processed (worker + Apify).
 * Prefer {@link canEnqueueCreatorEnrichment} for enqueue decisions.
 */
export function isCreatorEnrichmentEnabled(): boolean {
  return isCreatorEnrichmentWorkerEnabled();
}

export type EnrichmentGateDecision = {
  allowed: boolean;
  reason?: string;
};

/** Decide whether a job may be enqueued for the given trigger and scope. */
export function canEnqueueCreatorEnrichment(
  input: {
    trigger: EnrichmentTrigger;
    scope?: EnrichmentScope;
  },
  options?: { isBulk?: boolean }
): EnrichmentGateDecision {
  if (isCreatorEnrichmentMasterDisabled()) {
    return { allowed: false, reason: creatorEnrichmentDisabledMessage() };
  }

  const scope = input.scope ?? "all";

  if (AUTO_TRIGGERS.has(input.trigger)) {
    const settings = getCachedDiscoveryControlSettings();
    if (!shouldAutoEnrichForTrigger(input.trigger, settings)) {
      return {
        allowed: false,
        reason: `Automatic enrichment disabled by Discovery Control Center (${settings.automaticEnrichment}).`,
      };
    }
    if (!isAutoCreatorEnrichmentEnabled()) {
      return {
        allowed: false,
        reason: "Automatic creator enrichment is disabled (AUTO_CREATOR_ENRICHMENT=false).",
      };
    }
    return { allowed: true };
  }

  if (input.trigger === "manual") {
    if (!isManualEnrichmentAllowed()) {
      return {
        allowed: false,
        reason: "Manual creator enrichment is disabled (ALLOW_MANUAL_ENRICHMENT=false).",
      };
    }
    if (options?.isBulk && !isBulkEnrichmentAllowed()) {
      return {
        allowed: false,
        reason: "Bulk enrichment is disabled (ALLOW_BULK_ENRICHMENT=false).",
      };
    }
    if (!isScopeRefreshAllowed(scope)) {
      return {
        allowed: false,
        reason: `${scope} refresh is disabled.`,
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "Unsupported enrichment trigger." };
}

/** Human-readable reason for logs and API responses. */
export function creatorEnrichmentDisabledMessage(): string {
  if (isCreatorEnrichmentMasterDisabled()) {
    return "Creator enrichment is disabled (DISABLE_CREATOR_ENRICHMENT=true).";
  }
  if (!isManualEnrichmentAllowed() && !isAutoCreatorEnrichmentEnabled()) {
    return "Creator enrichment is disabled (enable ALLOW_MANUAL_ENRICHMENT or AUTO_CREATOR_ENRICHMENT).";
  }
  return "Creator enrichment is disabled.";
}
