"use server";

import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

import type { CreatorSearchIntentMode } from "@/features/discovery/components/creator-search/creator-search-intent-engine";

export type DiscoverySearchAnalyticsEventType =
  | "search_executed"
  | "creator_clicked"
  | "add_missing_creator"
  | "search_abandoned";

export type DiscoverySearchAnalyticsPayload = {
  eventType: DiscoverySearchAnalyticsEventType;
  query?: string | null;
  intentMode?: CreatorSearchIntentMode | null;
  confidence?: number | null;
  latencyMs?: number | null;
  resultsCount?: number | null;
  creatorUnifiedId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logDiscoverySearchAnalyticsAction(
  events: DiscoverySearchAnalyticsPayload[]
): Promise<{ ok: boolean; inserted: number }> {
  if (events.length === 0) return { ok: true, inserted: 0 };

  const supabase = await createSupabaseServerClient();
  const { user } = await getRequestAuth();

  const rows = events.map((event) => ({
    user_id: user?.id ?? null,
    event_type: event.eventType,
    query: event.query?.trim() || null,
    intent_mode: event.intentMode ?? null,
    confidence:
      typeof event.confidence === "number" ? Math.round(event.confidence) : null,
    latency_ms: typeof event.latencyMs === "number" ? Math.round(event.latencyMs) : null,
    results_count:
      typeof event.resultsCount === "number" ? Math.round(event.resultsCount) : null,
    creator_unified_id: event.creatorUnifiedId ?? null,
    metadata: (event.metadata ?? {}) as Json,
  }));

  const { error } = await supabase.from("discovery_search_analytics").insert(rows);

  if (error) {
    const tableMissing =
      error.message.includes("discovery_search_analytics") ||
      error.code === "PGRST205" ||
      error.code === "42P01";

    if (tableMissing) {
      return { ok: false, inserted: 0 };
    }

    throw new Error(error.message);
  }

  return { ok: true, inserted: rows.length };
}
