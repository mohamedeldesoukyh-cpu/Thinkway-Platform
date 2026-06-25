"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CommercialInputMode, Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import {
  computeQuotationTotals,
  normalizeCommercialLine,
} from "./quotation-engine";
import { QUOTATION_PERMISSIONS, QUOTATIONS_LIST_PATH, quotationDetailPath } from "./constants";
import type { ActionResult, QuotationDeliverable } from "./types";

type Supabase = SupabaseClient<Database>;

function revalidate(id?: string) {
  revalidatePath(QUOTATIONS_LIST_PATH);
  if (id) revalidatePath(quotationDetailPath(id));
}

async function getActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in adminAuth) return { ok: false, message: auth.error };
    return { ok: true, supabase, userId: adminAuth.userId };
  }
  return { ok: true, supabase, userId: auth.userId };
}

export type QuotationItemSeed = {
  influencer_id?: string | null;
  profile_id?: string | null;
  unified_id?: string | null;
  source_shortlist_item_id?: string | null;
  creator_name?: string | null;
  platform?: string | null;
  handle?: string | null;
  followers?: number | null;
  engagement_rate?: number | null;
  country_code?: string | null;
  deliverables?: QuotationDeliverable[];
  commercial_input_mode?: CommercialInputMode;
  cost?: number | null;
  cost_currency?: string | null;
  gp_pct?: number | null;
  revenue?: number | null;
  gp_value?: number | null;
};

async function buildItemRows(
  supabase: Supabase,
  quotationId: string,
  seeds: QuotationItemSeed[],
  startSort: number
) {
  // Cache rates so we resolve each distinct currency once per batch.
  const rateCache = new Map<string, number>();
  const rows = [];
  let sort = startSort;
  for (const seed of seeds) {
    const currency = (seed.cost_currency || REPORTING_CURRENCY).toUpperCase();
    let rate = rateCache.get(currency);
    if (rate == null) {
      rate = await resolveRateToEgp(supabase, currency);
      rateCache.set(currency, rate);
    }
    const mode: CommercialInputMode = seed.commercial_input_mode ?? "cost_gp_pct";
    const line = normalizeCommercialLine({
      mode,
      cost: seed.cost,
      costCurrency: currency,
      gpPct: seed.gp_pct,
      revenue: seed.revenue,
      gpValue: seed.gp_value,
      fxRateToEgp: rate,
    });
    rows.push({
      quotation_id: quotationId,
      influencer_id: seed.influencer_id ?? null,
      profile_id: seed.profile_id ?? null,
      unified_id: seed.unified_id ?? null,
      source_shortlist_item_id: seed.source_shortlist_item_id ?? null,
      creator_name: seed.creator_name ?? null,
      platform: seed.platform ?? null,
      handle: seed.handle ?? null,
      followers: seed.followers ?? null,
      engagement_rate: seed.engagement_rate ?? null,
      country_code: seed.country_code ?? null,
      deliverables: (seed.deliverables ?? []) as unknown as Database["public"]["Tables"]["quotation_items"]["Insert"]["deliverables"],
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
      sort_order: sort++,
    });
  }
  return rows;
}

/** Recompute and persist header totals from the quotation's items (EGP). */
async function recomputeTotals(supabase: Supabase, quotationId: string) {
  const { data } = await supabase
    .from("quotation_items")
    .select("cost_egp, revenue_egp, gp_value_egp")
    .eq("quotation_id", quotationId);

  const totals = computeQuotationTotals(
    (data ?? []).map((r) => ({
      cost_egp: Number((r as { cost_egp: number }).cost_egp ?? 0),
      revenue_egp: Number((r as { revenue_egp: number }).revenue_egp ?? 0),
      gp_value_egp: Number((r as { gp_value_egp: number }).gp_value_egp ?? 0),
    }))
  );

  await supabase
    .from("quotations")
    .update({
      total_cost_egp: totals.totalCostEgp,
      total_revenue_egp: totals.totalRevenueEgp,
      total_gp_value_egp: totals.totalGpValueEgp,
      total_gp_pct: totals.totalGpPct,
    } as never)
    .eq("id", quotationId);

  return totals;
}

async function insertQuotationHeader(
  supabase: Supabase,
  userId: string,
  patch: Partial<Database["public"]["Tables"]["quotations"]["Insert"]> & { name: string }
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("quotations")
    .insert({
      owner_id: userId,
      created_by: userId,
      currency: REPORTING_CURRENCY,
      ...patch,
    } as never)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Failed to create quotation." };
  }
  return { ok: true, id: (data as { id: string }).id };
}

// ---------------------------------------------------------------------------
// Create: manual (blank)
// ---------------------------------------------------------------------------
export async function createBlankQuotation(input: {
  name: string;
  client_id?: string | null;
  brand_id?: string | null;
  campaign_header_id?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const name = input.name?.trim();
  if (!name) return { ok: false, message: "Quotation name is required." };

  const created = await insertQuotationHeader(actor.supabase, actor.userId, {
    name,
    client_id: input.client_id ?? null,
    brand_id: input.brand_id ?? null,
    campaign_header_id: input.campaign_header_id ?? null,
  });
  if (!created.ok) return created;
  revalidate(created.id);
  return { ok: true, data: { id: created.id }, message: "Quotation created." };
}

// ---------------------------------------------------------------------------
// Create: from a Discovery selection (temporary workspace, spec §10)
// ---------------------------------------------------------------------------
export async function createQuotationFromSelection(input: {
  name?: string;
  creators: QuotationItemSeed[];
  client_id?: string | null;
  brand_id?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  if (!input.creators?.length) {
    return { ok: false, message: "Select at least one creator." };
  }

  const created = await insertQuotationHeader(actor.supabase, actor.userId, {
    name: input.name?.trim() || "Untitled quotation",
    client_id: input.client_id ?? null,
    brand_id: input.brand_id ?? null,
  });
  if (!created.ok) return created;

  const rows = await buildItemRows(actor.supabase, created.id, input.creators, 0);
  const { error } = await actor.supabase
    .from("quotation_items")
    .insert(rows as never);
  if (error) return { ok: false, message: error.message };

  await recomputeTotals(actor.supabase, created.id);
  revalidate(created.id);
  return {
    ok: true,
    data: { id: created.id },
    message: `Quotation created with ${rows.length} creator${rows.length === 1 ? "" : "s"}.`,
  };
}

// ---------------------------------------------------------------------------
// Create: from a Shortlist (carries per-item commercials, spec §7)
// ---------------------------------------------------------------------------
export async function createQuotationFromShortlist(
  shortlistId: string
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const { data: shortlist, error: slError } = await actor.supabase
    .from("discovery_shortlists")
    .select("id, name, client_id, brand_id, campaign_header_id")
    .eq("id", shortlistId)
    .maybeSingle();
  if (slError) return { ok: false, message: slError.message };
  if (!shortlist) return { ok: false, message: "Shortlist not found." };
  const sl = shortlist as {
    id: string;
    name: string;
    client_id: string | null;
    brand_id: string | null;
    campaign_header_id: string | null;
  };

  const { data: items, error: itemsError } = await actor.supabase
    .from("discovery_shortlist_items")
    .select(
      "id, influencer_id, profile_id, unified_id, commercial_input_mode, cost, cost_currency, gp_pct, revenue, gp_value, deliverables, sort_order"
    )
    .eq("shortlist_id", shortlistId)
    .order("sort_order", { ascending: true });
  if (itemsError) return { ok: false, message: itemsError.message };

  const created = await insertQuotationHeader(actor.supabase, actor.userId, {
    name: `Quotation — ${sl.name}`,
    shortlist_id: sl.id,
    client_id: sl.client_id,
    brand_id: sl.brand_id,
    campaign_header_id: sl.campaign_header_id,
  });
  if (!created.ok) return created;

  const seeds: QuotationItemSeed[] = (items ?? []).map((raw) => {
    const item = raw as {
      id: string;
      influencer_id: string | null;
      profile_id: string | null;
      unified_id: string | null;
      commercial_input_mode: CommercialInputMode;
      cost: number | null;
      cost_currency: string | null;
      gp_pct: number | null;
      revenue: number | null;
      gp_value: number | null;
      deliverables: unknown;
    };
    return {
      influencer_id: item.influencer_id,
      profile_id: item.profile_id,
      unified_id: item.unified_id,
      source_shortlist_item_id: item.id,
      deliverables: Array.isArray(item.deliverables)
        ? (item.deliverables as QuotationDeliverable[])
        : [],
      commercial_input_mode: item.commercial_input_mode ?? "cost_gp_pct",
      cost: item.cost,
      cost_currency: item.cost_currency,
      gp_pct: item.gp_pct,
      revenue: item.revenue,
      gp_value: item.gp_value,
    };
  });

  if (seeds.length) {
    const rows = await buildItemRows(actor.supabase, created.id, seeds, 0);
    const { error } = await actor.supabase
      .from("quotation_items")
      .insert(rows as never);
    if (error) return { ok: false, message: error.message };
    await recomputeTotals(actor.supabase, created.id);
  }

  revalidate(created.id);
  return {
    ok: true,
    data: { id: created.id },
    message: `Quotation created from shortlist (${seeds.length} creators).`,
  };
}

// ---------------------------------------------------------------------------
// Add creators to an existing quotation
// ---------------------------------------------------------------------------
export async function addItemsToQuotation(
  quotationId: string,
  creators: QuotationItemSeed[]
): Promise<ActionResult<{ added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  if (!creators?.length) return { ok: false, message: "No creators provided." };

  const { data: maxRow } = await actor.supabase
    .from("quotation_items")
    .select("sort_order")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const startSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const rows = await buildItemRows(actor.supabase, quotationId, creators, startSort);
  const { error } = await actor.supabase
    .from("quotation_items")
    .insert(rows as never);
  if (error) return { ok: false, message: error.message };

  await recomputeTotals(actor.supabase, quotationId);
  revalidate(quotationId);
  return { ok: true, data: { added: rows.length }, message: "Creators added." };
}

// ---------------------------------------------------------------------------
// Autosave: per-item commercials (spec §11)
// ---------------------------------------------------------------------------
export async function updateQuotationItemCommercials(input: {
  item_id: string;
  quotation_id: string;
  mode: CommercialInputMode;
  cost: number | null;
  cost_currency: string;
  gp_pct?: number | null;
  revenue?: number | null;
  gp_value?: number | null;
  deliverables?: QuotationDeliverable[];
}): Promise<ActionResult<{ totals: ReturnType<typeof computeQuotationTotals> }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const rate = await resolveRateToEgp(actor.supabase, input.cost_currency);
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
  };
  if (input.deliverables) patch.deliverables = input.deliverables;

  const { error } = await actor.supabase
    .from("quotation_items")
    .update(patch as never)
    .eq("id", input.item_id);
  if (error) return { ok: false, message: error.message };

  const totals = await recomputeTotals(actor.supabase, input.quotation_id);
  revalidate(input.quotation_id);
  return { ok: true, data: { totals } };
}

// ---------------------------------------------------------------------------
// Autosave: quotation header fields (name/notes/terms/links)
// ---------------------------------------------------------------------------
export async function updateQuotationHeader(input: {
  id: string;
  name?: string;
  notes?: string | null;
  terms?: string | null;
  client_id?: string | null;
  brand_id?: string | null;
  campaign_header_id?: string | null;
  prepared_by_name?: string | null;
  client_signature_name?: string | null;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, message: "Name cannot be empty." };
    patch.name = name;
  }
  for (const key of [
    "notes",
    "terms",
    "client_id",
    "brand_id",
    "campaign_header_id",
    "prepared_by_name",
    "client_signature_name",
  ] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await actor.supabase
    .from("quotations")
    .update(patch as never)
    .eq("id", input.id);
  if (error) return { ok: false, message: error.message };
  revalidate(input.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Remove item / archive / status
// ---------------------------------------------------------------------------
export async function removeQuotationItem(input: {
  item_id: string;
  quotation_id: string;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const { error } = await actor.supabase
    .from("quotation_items")
    .delete()
    .eq("id", input.item_id);
  if (error) return { ok: false, message: error.message };
  await recomputeTotals(actor.supabase, input.quotation_id);
  revalidate(input.quotation_id);
  return { ok: true, message: "Creator removed." };
}

export async function archiveQuotation(id: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const { error } = await actor.supabase
    .from("quotations")
    .update({ is_archived: true, status: "archived" } as never)
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidate(id);
  return { ok: true, message: "Quotation archived." };
}
