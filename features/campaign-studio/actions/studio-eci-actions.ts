"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { loadStudioEciPlanningSignals } from "../services/eci/load-studio-eci-signals";
import type { StudioEciPlanningSignal } from "../services/eci/project-studio-eci-signal";

/** Serializable map for client hydration (influencerId → signal). */
export type StudioEciSignalRecord = Record<string, StudioEciPlanningSignal>;

/**
 * Load Enterprise Creator Intelligence planning signals for Studio.
 * Consume-only — canonical entry inside loadStudioEciPlanningSignals.
 */
export async function loadStudioEciPlanningSignalsAction(
  creatorIds: string[],
  platform?: string | null
): Promise<StudioEciSignalRecord> {
  const ids = creatorIds.filter(Boolean).slice(0, 200);
  if (ids.length === 0) return {};

  try {
    const supabase = await createSupabaseServerClient();
    const signals = await loadStudioEciPlanningSignals(supabase, ids, { platform });
    const record: StudioEciSignalRecord = {};
    for (const [key, signal] of signals) {
      if (key.startsWith("inf:")) continue;
      record[signal.influencerId] = signal;
    }
    return record;
  } catch {
    return {};
  }
}
