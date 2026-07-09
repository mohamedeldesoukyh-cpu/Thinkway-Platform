/**
 * Refresh policy resolution — DB-backed TTL with env/constant fallbacks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  IPL_DEFAULT_FOLLOWER_TIER_OVERRIDES,
  IPL_DEFAULT_TTL_DAYS,
} from "../config";
import type { IplFieldGroup, IplProvider, IplRefreshPolicy } from "../types";

type AnySupabase = SupabaseClient;

/** In-memory cache of policies (refreshed on first miss per process). */
let policyCache: IplRefreshPolicy[] | null = null;
let policyCacheLoadedAt = 0;
const POLICY_CACHE_TTL_MS = 5 * 60 * 1000;

function mapPolicyRow(row: Record<string, unknown>): IplRefreshPolicy {
  return {
    id: String(row.id),
    provider: String(row.provider),
    fieldGroup: String(row.field_group) as IplFieldGroup,
    ttlDays: Number(row.ttl_days),
    followerTierOverrides:
      (row.follower_tier_overrides as Record<string, number>) ?? {},
    isActive: Boolean(row.is_active),
  };
}

export async function loadRefreshPolicies(
  supabase: AnySupabase
): Promise<IplRefreshPolicy[]> {
  const now = Date.now();
  if (policyCache && now - policyCacheLoadedAt < POLICY_CACHE_TTL_MS) {
    return policyCache;
  }

  const { data, error } = await supabase
    .from("ipl_refresh_policies")
    .select("id, provider, field_group, ttl_days, follower_tier_overrides, is_active")
    .eq("is_active", true);

  if (error) {
    console.warn("[ipl] refresh policy load failed, using defaults", error.message);
    policyCache = [];
    policyCacheLoadedAt = now;
    return policyCache;
  }

  policyCache = (data ?? []).map((row) => mapPolicyRow(row as Record<string, unknown>));
  policyCacheLoadedAt = now;
  return policyCache;
}

/** Clear in-process policy cache (tests / admin refresh). */
export function clearRefreshPolicyCache(): void {
  policyCache = null;
  policyCacheLoadedAt = 0;
}

function resolveTtlFromTiers(
  baseTtlDays: number,
  followerCount: number | null | undefined,
  tierOverrides: Record<string, number>
): number {
  const followers = followerCount ?? 0;
  const merged = { ...IPL_DEFAULT_FOLLOWER_TIER_OVERRIDES, ...tierOverrides };
  const tiers = Object.entries(merged)
    .map(([threshold, days]) => ({ threshold: Number(threshold), days }))
    .filter((t) => Number.isFinite(t.threshold) && t.days > 0)
    .sort((a, b) => b.threshold - a.threshold);

  for (const tier of tiers) {
    if (followers >= tier.threshold) return tier.days;
  }
  return baseTtlDays;
}

export async function resolveRefreshTtlDays(
  supabase: AnySupabase,
  input: {
    provider: IplProvider;
    fieldGroup?: IplFieldGroup;
    followerCount?: number | null;
  }
): Promise<number> {
  const fieldGroup = input.fieldGroup ?? "all";
  const policies = await loadRefreshPolicies(supabase);

  const match =
    policies.find((p) => p.provider === input.provider && p.fieldGroup === fieldGroup) ??
    policies.find((p) => p.provider === input.provider && p.fieldGroup === "all");

  const baseTtl = match?.ttlDays ?? IPL_DEFAULT_TTL_DAYS;
  return resolveTtlFromTiers(baseTtl, input.followerCount, match?.followerTierOverrides ?? {});
}

export function computeExpiresAt(fromIso: string, ttlDays: number): string {
  const from = new Date(fromIso).getTime();
  return new Date(from + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

export function isSnapshotFresh(
  fetchedAt: string,
  expiresAt: string | null,
  now: number = Date.now()
): boolean {
  if (expiresAt) {
    const exp = new Date(expiresAt).getTime();
    if (!Number.isNaN(exp)) return now < exp;
  }
  return false;
}
