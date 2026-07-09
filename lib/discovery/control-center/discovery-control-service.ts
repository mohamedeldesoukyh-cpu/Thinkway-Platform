import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DISCOVERY_CONTROL_SETTINGS_ID,
  type DiscoveryControlSettings,
  type DiscoveryApifyDailyUsage,
} from "./discovery-control-types";

const CACHE_TTL_MS = 30_000;

let cachedSettings: DiscoveryControlSettings | null = null;
let cacheLoadedAt = 0;

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampThreshold(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
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
    costProtection: {
      maxRequestsPerDay: 0,
      maxCreditsPerDay: 0,
      confirmBeforeExceed: false,
    },
  };
}

function mergeWithDefaults(
  partial: Partial<DiscoveryControlSettings> | null | undefined
): DiscoveryControlSettings {
  const defaults = getDefaultDiscoveryControlSettings();
  if (!partial || typeof partial !== "object") return defaults;

  return {
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
        partial.dnaPolicy?.updateAfterEnrichment ?? defaults.dnaPolicy.updateAfterEnrichment,
      calculateCompleteness:
        partial.dnaPolicy?.calculateCompleteness ?? defaults.dnaPolicy.calculateCompleteness,
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
      maxRequestsPerDay: Math.max(
        0,
        partial.costProtection?.maxRequestsPerDay ?? defaults.costProtection.maxRequestsPerDay
      ),
      maxCreditsPerDay: Math.max(
        0,
        partial.costProtection?.maxCreditsPerDay ?? defaults.costProtection.maxCreditsPerDay
      ),
      confirmBeforeExceed:
        partial.costProtection?.confirmBeforeExceed ??
        defaults.costProtection.confirmBeforeExceed,
    },
  };
}

export function getCachedDiscoveryControlSettings(): DiscoveryControlSettings {
  return cachedSettings ?? getDefaultDiscoveryControlSettings();
}

export function invalidateDiscoveryControlSettingsCache(): void {
  cachedSettings = null;
  cacheLoadedAt = 0;
}

export async function getDiscoveryControlSettings(
  supabase?: SupabaseClient
): Promise<DiscoveryControlSettings> {
  if (!supabase) {
    return getCachedDiscoveryControlSettings();
  }

  const now = Date.now();
  if (cachedSettings && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabase
      .from("discovery_control_settings")
      .select("settings")
      .eq("id", DISCOVERY_CONTROL_SETTINGS_ID)
      .maybeSingle();

    if (!error && data?.settings) {
      cachedSettings = mergeWithDefaults(
        data.settings as Partial<DiscoveryControlSettings>
      );
      cacheLoadedAt = now;
      return cachedSettings;
    }
  } catch {
    // Table may not be migrated yet — fall back to defaults.
  }

  return getCachedDiscoveryControlSettings();
}

export async function updateDiscoveryControlSettings(
  supabase: SupabaseClient,
  settings: DiscoveryControlSettings,
  updatedBy: string
): Promise<{ ok: boolean; error?: string }> {
  const normalized = mergeWithDefaults(settings);

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

  cachedSettings = normalized;
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
