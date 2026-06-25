"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { normalizeCommercialLine } from "@/features/quotations/quotation-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CommercialInputMode, Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SHORTLIST_PERMISSIONS } from "./constants";
import type { ActionResult } from "./types";

type Supabase = SupabaseClient<Database>;

type ShortlistDeliverable = { platform: string; type: string; quantity: number };

/**
 * Autosave per-creator commercials on a shortlist item (Commercial tab, spec §5/§6).
 * Normalizes via the shared commercial engine + resolves FX → EGP, persisting both
 * original-currency and EGP-converted values for stable reporting/quotations.
 */
export async function updateShortlistItemCommercials(input: {
  item_id: string;
  shortlist_id: string;
  mode: CommercialInputMode;
  cost: number | null;
  cost_currency: string;
  gp_pct?: number | null;
  revenue?: number | null;
  gp_value?: number | null;
  deliverables?: ShortlistDeliverable[];
}): Promise<ActionResult> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) {
    const admin = await requirePermission(supabase, SHORTLIST_PERMISSIONS.admin);
    if ("error" in admin) return { ok: false, message: auth.error };
  }

  const rate = await resolveRateToEgp(supabase, input.cost_currency);
  const line = normalizeCommercialLine({
    mode: input.mode,
    cost: input.cost,
    costCurrency: input.cost_currency,
    gpPct: input.gp_pct,
    revenue: input.revenue,
    gpValue: input.gp_value,
    fxRateToEgp: rate,
  });

  const patch: Record<string, unknown> = {
    commercial_input_mode: line.commercial_input_mode,
    cost: line.cost,
    cost_currency: line.cost_currency,
    revenue: line.revenue,
    gp_pct: line.gp_pct,
    gp_value: line.gp_value,
    fx_rate_to_egp: line.fx_rate_to_egp,
    cost_egp: line.cost_egp,
    revenue_egp: line.revenue_egp,
    gp_value_egp: line.gp_value_egp,
    commercial_updated_at: new Date().toISOString(),
  };
  if (input.deliverables) patch.deliverables = input.deliverables;

  const { error } = await supabase
    .from("discovery_shortlist_items")
    .update(patch as never)
    .eq("id", input.item_id);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/discovery/shortlists/${input.shortlist_id}`);
  return { ok: true };
}
