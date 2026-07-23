import { formatDistanceToNow } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type CreatorHoverDetails = {
  totalCollaborations: number;
  collaborationsWithYou: number;
  statusLabel: string | null;
};

export function formatCreatorRecencyLabel(
  lastEnrichedAt: string | null | undefined,
  updatedAt: string | null | undefined
): string | null {
  const iso = resolveCreatorRecencyIso(lastEnrichedAt, updatedAt);
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Updated ${formatDistanceToNow(date, { addSuffix: true })}`;
}

/** Most recent profile/enrichment touch — avoids stale enrichment hiding fresher updates. */
export function resolveCreatorRecencyIso(
  lastEnrichedAt: string | null | undefined,
  updatedAt: string | null | undefined
): string | null {
  const candidates = [lastEnrichedAt, updatedAt]
    .map((value) => value?.trim() || null)
    .filter((value): value is string => Boolean(value));

  let latestMs = Number.NEGATIVE_INFINITY;
  let latestIso: string | null = null;

  for (const iso of candidates) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms) || ms > latestMs) {
      latestMs = ms;
      latestIso = iso;
    }
  }

  return latestIso;
}

export async function loadCreatorHoverDetails(
  supabase: SupabaseClient,
  userId: string,
  creator: UnifiedCreatorResult
): Promise<CreatorHoverDetails> {
  const statusLabel = formatCreatorRecencyLabel(
    creator.last_enriched_at,
    creator.updated_at
  );

  if (!creator.influencer_id) {
    return {
      totalCollaborations: 0,
      collaborationsWithYou: 0,
      statusLabel,
    };
  }

  const influencerId = creator.influencer_id;

  const [totalResult, withYouResult] = await Promise.all([
    supabase
      .from("campaign_influencers")
      .select("id", { count: "exact", head: true })
      .eq("influencer_id", influencerId),
    supabase
      .from("campaign_influencers")
      .select("id, campaign_headers!inner(account_manager_id)", { count: "exact", head: true })
      .eq("influencer_id", influencerId)
      .eq("campaign_headers.account_manager_id", userId),
  ]);

  return {
    totalCollaborations: totalResult.count ?? 0,
    collaborationsWithYou: withYouResult.count ?? 0,
    statusLabel,
  };
}

export function formatCollaborationsLine(
  total: number,
  withYou: number
): string {
  const totalLabel = total === 1 ? "1 collaboration" : `${total} collaborations`;
  const withYouLabel =
    withYou === 1 ? "1 with you" : `${withYou} with you`;
  return `${totalLabel} · ${withYouLabel}`;
}
