/**
 * Server-side Studio loader for Enterprise Creator Intelligence.
 * Canonical entry only: loadCreatorIntelligenceBundles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createEciFactsCache,
  loadCreatorIntelligenceBundles,
} from "@/lib/enterprise-creator-intelligence";

import {
  buildStudioEciSignalMap,
  type StudioEciPlanningSignal,
} from "./project-studio-eci-signal";

function toInfluencerId(creatorId: string): string | null {
  const trimmed = creatorId.trim();
  if (!trimmed || trimmed.startsWith("dp:") || trimmed.startsWith("dis:")) return null;
  if (trimmed.startsWith("inf:")) return trimmed.slice(4) || null;
  return trimmed;
}

/**
 * Load ECI planning signals for Studio creator ids.
 * Discovery-only / draft placeholder ids are skipped.
 */
export async function loadStudioEciPlanningSignals(
  supabase: SupabaseClient,
  creatorIds: string[],
  options?: { platform?: string | null; concurrency?: number }
): Promise<Map<string, StudioEciPlanningSignal>> {
  const influencerIds = [
    ...new Set(
      creatorIds
        .map(toInfluencerId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (influencerIds.length === 0) return new Map();

  const cache = createEciFactsCache();
  const { bundles } = await loadCreatorIntelligenceBundles(supabase, {
    influencerIds,
    platform: options?.platform ?? null,
    concurrency: options?.concurrency ?? 8,
    cache,
  });

  return buildStudioEciSignalMap(bundles);
}
