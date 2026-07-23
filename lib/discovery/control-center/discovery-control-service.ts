import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DISCOVERY_CONTROL_SETTINGS_ID,
  type DiscoveryControlSettings,
  type DiscoveryApifyDailyUsage,
} from "./discovery-control-types";

const CACHE_TTL_MS = 30_000;

let cachedSettings: DiscoveryControlSettings | null = null;
let cachedProvenance: DiscoveryControlCostProtectionProvenance | null = null;
let cacheLoadedAt = 0;

export type ApifyBudgetCapSource = "database" | "env" | "unset";

export type DiscoveryControlCostProtectionProvenance = {
  loadedFrom: "database" | "cache" | "env_defaults";
  maxRequestsPerDay: {
    databaseRaw: number | null;
    envRaw: string | null;
    envParsed: number;
    effective: number;
    source: ApifyBudgetCapSource;
  };
  maxCreditsPerDay: {
    databaseRaw: number | null;
    envRaw: string | null;
    envParsed: number;
    effective: number;
    source: ApifyBudgetCapSource;
  };
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envRaw(name: string): string | null {
  const raw = process.env[name];
  return raw === undefined ? null : raw;
}

function clampThreshold(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Positive DB/UI value wins. Non-positive or missing DB value falls through to env.
 * This matters because discovery_control_settings was seeded with 0/0 — previously
 * `0 ?? env` kept 0 and ignored DISCOVERY_APIFY_MAX_* env vars.
 */
export function resolveCostProtectionCap(
  databaseRaw: number | null,
  envParsed: number
): { effective: number; source: ApifyBudgetCapSource } {
  if (databaseRaw != null && databaseRaw > 0) {
    return { effective: databaseRaw, source: "database" };
  }
  if (envParsed > 0) {
    return { effective: envParsed, source: "env" };
  }
  return { effective: 0, source: "unset" };
}

export function getDefaultDiscoveryControlSettings(): DiscoveryControlSettings {
  return {
    discoverySource: "hybrid",
    searchPriority: "database_first",
    coverageThreshold: clampThreshold(
      envNumber("DISCOVERY_COVERAGE_SCORE_THRESHOLD", 80)
    ),
    automaticEnrichment: "never",
    dnaPolicy: {
      generateAfterImport: true,
      updateAfterEnrichment: true,
      calculateCompleteness: true,
    },
    dataFreshnessDays: null,
    // Fail-closed defaults: 0 means reject all Apify acquisition until ops set positive caps.
    costProtection: {
      maxRequestsPerDay: envNumber("DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY", 0),
      maxCreditsPerDay: envNumber("DISCOVERY_APIFY_MAX_CREDITS_PER_DAY", 0),
      confirmBeforeExceed: false,
    },
  };
}

function buildCostProtectionProvenance(
  loadedFrom: DiscoveryControlCostProtectionProvenance["loadedFrom"],
  databaseCostProtection?: {
    maxRequestsPerDay?: unknown;
    maxCreditsPerDay?: unknown;
  } | null
): DiscoveryControlCostProtectionProvenance {
  const envRequestsParsed = envNumber("DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY", 0);
  const envCreditsParsed = envNumber("DISCOVERY_APIFY_MAX_CREDITS_PER_DAY", 0);
  const dbRequests = parseOptionalNumber(databaseCostProtection?.maxRequestsPerDay);
  const dbCredits = parseOptionalNumber(databaseCostProtection?.maxCreditsPerDay);
  const requests = resolveCostProtectionCap(dbRequests, envRequestsParsed);
  const credits = resolveCostProtectionCap(dbCredits, envCreditsParsed);

  return {
    loadedFrom,
    maxRequestsPerDay: {
      databaseRaw: dbRequests,
      envRaw: envRaw("DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY"),
      envParsed: envRequestsParsed,
      effective: requests.effective,
      source: requests.source,
    },
    maxCreditsPerDay: {
      databaseRaw: dbCredits,
      envRaw: envRaw("DISCOVERY_APIFY_MAX_CREDITS_PER_DAY"),
      envParsed: envCreditsParsed,
      effective: credits.effective,
      source: credits.source,
    },
  };
}

export function mergeWithDefaults(
  partial: Partial<DiscoveryControlSettings> | null | undefined
): {
  settings: DiscoveryControlSettings;
  provenance: DiscoveryControlCostProtectionProvenance;
} {
  const defaults = getDefaultDiscoveryControlSettings();
  if (!partial || typeof partial !== "object") {
    return {
      settings: defaults,
      provenance: buildCostProtectionProvenance("env_defaults", null),
    };
  }

  const provenance = buildCostProtectionProvenance("database", partial.costProtection);

  return {
    settings: {
      discoverySource: partial.discoverySource ?? defaults.discoverySource,
      searchPriority: partial.searchPriority ?? defaults.searchPriority,
      coverageThreshold: clampThreshold(
        partial.coverageThreshold ?? defaults.coverageThreshold
      ),
      automaticEnrichment: partial.automaticEnrichment ?? defaults.automaticEnrichment,
      dnaPolicy: {
        generateAfterImport:
          partial.dnaPolicy?.generateAfterImport ?? defaults.dnaPolicy.generateAfterImport,
        updateAfterEnrichment:
          partial.dnaPolicy?.updateAfterEnrichment ??
          defaults.dnaPolicy.updateAfterEnrichment,
        calculateCompleteness:
          partial.dnaPolicy?.calculateCompleteness ??
          defaults.dnaPolicy.calculateCompleteness,
      },
      dataFreshnessDays:
        partial.dataFreshnessDays === 7 ||
        partial.dataFreshnessDays === 30 ||
        partial.dataFreshnessDays === 90
          ? partial.dataFreshnessDays
          : partial.dataFreshnessDays === null
            ? null
            : defaults.dataFreshnessDays,
      costProtection: {
        maxRequestsPerDay: provenance.maxRequestsPerDay.effective,
        maxCreditsPerDay: provenance.maxCreditsPerDay.effective,
        confirmBeforeExceed:
          partial.costProtection?.confirmBeforeExceed ??
          defaults.costProtection.confirmBeforeExceed,
      },
    },
    provenance,
  };
}

export function getCachedDiscoveryControlSettings(): DiscoveryControlSettings {
  return cachedSettings ?? getDefaultDiscoveryControlSettings();
}

export function getCachedDiscoveryControlCostProtectionProvenance(): DiscoveryControlCostProtectionProvenance | null {
  return cachedProvenance;
}

export function invalidateDiscoveryControlSettingsCache(): void {
  cachedSettings = null;
  cachedProvenance = null;
  cacheLoadedAt = 0;
}

export async function getDiscoveryControlSettings(
  supabase?: SupabaseClient
): Promise<DiscoveryControlSettings> {
  const loaded = await loadDiscoveryControlSettings(supabase);
  return loaded.settings;
}

export async function loadDiscoveryControlSettings(
  supabase?: SupabaseClient
): Promise<{
  settings: DiscoveryControlSettings;
  provenance: DiscoveryControlCostProtectionProvenance;
}> {
  if (!supabase) {
    const provenance =
      cachedProvenance ?? buildCostProtectionProvenance("env_defaults", null);
    return {
      settings: getCachedDiscoveryControlSettings(),
      provenance,
    };
  }

  const now = Date.now();
  if (cachedSettings && cachedProvenance && now - cacheLoadedAt < CACHE_TTL_MS) {
    return {
      settings: cachedSettings,
      provenance: { ...cachedProvenance, loadedFrom: "cache" },
    };
  }

  try {
    const { data, error } = await supabase
      .from("discovery_control_settings")
      .select("settings")
      .eq("id", DISCOVERY_CONTROL_SETTINGS_ID)
      .maybeSingle();

    if (!error && data?.settings) {
      const merged = mergeWithDefaults(
        data.settings as Partial<DiscoveryControlSettings>
      );
      cachedSettings = merged.settings;
      cachedProvenance = merged.provenance;
      cacheLoadedAt = now;
      return merged;
    }
  } catch {
    // Table may not be migrated yet — fall back to defaults.
  }

  const fallback = {
    settings: getDefaultDiscoveryControlSettings(),
    provenance: buildCostProtectionProvenance("env_defaults", null),
  };
  cachedSettings = fallback.settings;
  cachedProvenance = fallback.provenance;
  cacheLoadedAt = now;
  return fallback;
}

export async function updateDiscoveryControlSettings(
  supabase: SupabaseClient,
  settings: DiscoveryControlSettings,
  updatedBy: string
): Promise<{ ok: boolean; error?: string }> {
  const normalized = mergeWithDefaults(settings).settings;

  const { error } = await supabase.from("discovery_control_settings").upsert(
    {
      id: DISCOVERY_CONTROL_SETTINGS_ID,
      settings: normalized,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  const loaded = mergeWithDefaults(normalized);
  cachedSettings = loaded.settings;
  cachedProvenance = loaded.provenance;
  cacheLoadedAt = Date.now();
  return { ok: true };
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDiscoveryApifyDailyUsage(
  supabase: SupabaseClient,
  usageDate: string = todayUtcDate()
): Promise<DiscoveryApifyDailyUsage> {
  try {
    const { data, error } = await supabase
      .from("discovery_apify_usage")
      .select("usage_date, request_count, credits_used")
      .eq("usage_date", usageDate)
      .maybeSingle();

    if (!error && data) {
      return {
        usageDate: String(data.usage_date),
        requestCount: Number(data.request_count ?? 0),
        creditsUsed: Number(data.credits_used ?? 0),
      };
    }
  } catch {
    // Table may not exist yet.
  }

  return { usageDate, requestCount: 0, creditsUsed: 0 };
}

export async function recordDiscoveryApifyUsage(
  supabase: SupabaseClient,
  input: { requests?: number; credits?: number; usageDate?: string }
): Promise<void> {
  const usageDate = input.usageDate ?? todayUtcDate();
  const requests = Math.max(0, input.requests ?? 1);
  const credits = Math.max(0, input.credits ?? 0);

  try {
    const current = await getDiscoveryApifyDailyUsage(supabase, usageDate);
    await supabase.from("discovery_apify_usage").upsert(
      {
        usage_date: usageDate,
        request_count: current.requestCount + requests,
        credits_used: current.creditsUsed + credits,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "usage_date" }
    );
  } catch {
    // Non-blocking when table is unavailable.
  }
}
