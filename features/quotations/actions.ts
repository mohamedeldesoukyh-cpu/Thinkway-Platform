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
import {
  buildSeedsFromShortlistItems,
  filterNewShortlistImportItems,
  type ShortlistItemForSeed,
} from "./shortlist-seeds";
import { QUOTATION_PERMISSIONS, QUOTATIONS_LIST_PATH, quotationDetailPath } from "./constants";
import { formatQuotationTermsText } from "./quotation-default-terms";
import { defaultValidityDateFromIssue } from "./quotation-validity";
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
  af_pct?: number | null;
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
    const mode: CommercialInputMode = seed.commercial_input_mode ?? "cost_markup_pct";
    const line = normalizeCommercialLine({
      mode,
      cost: seed.cost,
      costCurrency: currency,
      gpPct: seed.gp_pct,
      revenue: seed.revenue,
      gpValue: seed.gp_value,
      afPct: seed.af_pct,
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
      af_pct: line.af_pct,
      af_value: line.af_value,
      fx_rate_to_egp: line.fx_rate_to_egp,
      cost_egp: line.cost_egp,
      revenue_egp: line.revenue_egp,
      gp_value_egp: line.gp_value_egp,
      af_value_egp: line.af_value_egp,
      sort_order: sort++,
    });
  }
  return rows;
}

/** Recompute and persist header totals from the quotation's items (EGP). */
async function recomputeTotals(supabase: Supabase, quotationId: string) {
  const { data } = await supabase
    .from("quotation_items")
    .select("cost_egp, revenue_egp, gp_value_egp, af_value_egp")
    .eq("quotation_id", quotationId);

  const totals = computeQuotationTotals(
    (data ?? []).map((r) => ({
      cost_egp: Number((r as { cost_egp: number }).cost_egp ?? 0),
      revenue_egp: Number((r as { revenue_egp: number }).revenue_egp ?? 0),
      gp_value_egp: Number((r as { gp_value_egp: number }).gp_value_egp ?? 0),
      af_value_egp: Number((r as { af_value_egp: number }).af_value_egp ?? 0),
    }))
  );

  await supabase
    .from("quotations")
    .update({
      total_cost_egp: totals.totalCostEgp,
      total_revenue_egp: totals.totalRevenueEgp,
      total_gp_value_egp: totals.totalGpValueEgp,
      total_gp_pct: totals.totalGpPct,
      total_af_egp: totals.totalAfValueEgp,
      total_agency_margin_egp: totals.totalAgencyMarginEgp,
    } as never)
    .eq("id", quotationId);

  return totals;
}

async function appendQuotationRevision(
  supabase: Supabase,
  input: {
    quotationId: string;
    userId: string;
    version: string;
    changeSummary: string;
    updatedByName?: string | null;
  }
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", input.userId)
    .maybeSingle();

  await supabase.from("quotation_revisions").insert({
    quotation_id: input.quotationId,
    version: input.version,
    updated_by: input.userId,
    updated_by_name:
      input.updatedByName ??
      (profile as { full_name: string } | null)?.full_name ??
      null,
    change_summary: input.changeSummary,
  } as never);
}

async function insertQuotationHeader(
  supabase: Supabase,
  userId: string,
  patch: Partial<Database["public"]["Tables"]["quotations"]["Insert"]> & { name: string }
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const issueDate = patch.issue_date ?? new Date().toISOString().slice(0, 10);
  const validityDate =
    patch.validity_date ?? defaultValidityDateFromIssue(issueDate);

  const { data, error } = await supabase
    .from("quotations")
    .insert({
      owner_id: userId,
      created_by: userId,
      currency: REPORTING_CURRENCY,
      issue_date: issueDate,
      validity_date: validityDate,
      terms: patch.terms ?? formatQuotationTermsText(),
      version: patch.version ?? "v1.0",
      department: patch.department ?? "Influencer Marketing",
      ...patch,
    } as never)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Failed to create quotation." };
  }
  const id = (data as { id: string }).id;
  await appendQuotationRevision(supabase, {
    quotationId: id,
    userId,
    version: (patch.version as string) ?? "v1.0",
    changeSummary: "Initial quotation created",
  });
  return { ok: true, id };
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
  if (!input.client_id || !input.brand_id) {
    return {
      ok: false,
      message: "Client and brand are required to create a quotation.",
    };
  }

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

async function loadShortlistItemsForSeeds(
  supabase: Supabase,
  shortlistId: string,
  itemIds?: string[]
): Promise<{ ok: true; items: ShortlistItemForSeed[] } | { ok: false; message: string }> {
  let query = supabase
    .from("discovery_shortlist_items")
    .select(
      "id, influencer_id, profile_id, unified_id, commercial_input_mode, cost, cost_currency, gp_pct, revenue, gp_value, deliverables, sort_order"
    )
    .eq("shortlist_id", shortlistId)
    .order("sort_order", { ascending: true });

  if (itemIds?.length) {
    query = query.in("id", itemIds);
  }

  const { data, error } = await query;
  if (error) return { ok: false, message: error.message };
  return { ok: true, items: (data ?? []) as ShortlistItemForSeed[] };
}

async function insertQuotationSeeds(
  supabase: Supabase,
  quotationId: string,
  seeds: QuotationItemSeed[],
  startSort = 0
): Promise<ActionResult<{ inserted: number }>> {
  if (!seeds.length) return { ok: true, data: { inserted: 0 } };
  const rows = await buildItemRows(supabase, quotationId, seeds, startSort);
  const { error } = await supabase.from("quotation_items").insert(rows as never);
  if (error) return { ok: false, message: error.message };
  await recomputeTotals(supabase, quotationId);
  return { ok: true, data: { inserted: rows.length } };
}

/** Latest non-archived draft quotation linked to a shortlist, if any. */
export async function findOpenQuotationForShortlist(
  shortlistId: string
): Promise<ActionResult<{ id: string | null }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const { data, error } = await actor.supabase
    .from("quotations")
    .select("id")
    .eq("shortlist_id", shortlistId)
    .eq("is_archived", false)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: (data as { id: string } | null)?.id ?? null } };
}

// ---------------------------------------------------------------------------
// Create: from a Shortlist (carries per-item commercials, spec §7)
// ---------------------------------------------------------------------------
export async function createQuotationFromShortlist(
  shortlistId: string,
  options?: { itemIds?: string[] }
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

  const loaded = await loadShortlistItemsForSeeds(
    actor.supabase,
    shortlistId,
    options?.itemIds
  );
  if (!loaded.ok) return loaded;
  if (loaded.items.length === 0) {
    return { ok: false, message: "No creators to quote on this shortlist." };
  }

  const seeds = await buildSeedsFromShortlistItems(actor.supabase, loaded.items);

  const created = await insertQuotationHeader(actor.supabase, actor.userId, {
    name: `Quotation — ${sl.name}`,
    shortlist_id: sl.id,
    client_id: sl.client_id,
    brand_id: sl.brand_id,
    campaign_header_id: sl.campaign_header_id,
  });
  if (!created.ok) return created;

  const inserted = await insertQuotationSeeds(actor.supabase, created.id, seeds, 0);
  if (!inserted.ok) return inserted;

  revalidate(created.id);
  return {
    ok: true,
    data: { id: created.id },
    message: `Quotation created with ${inserted.data?.inserted ?? seeds.length} creator${
      (inserted.data?.inserted ?? seeds.length) === 1 ? "" : "s"
    }.`,
  };
}

/** Append shortlist creators to an existing quotation (dedupes by source_shortlist_item_id). */
export async function importShortlistItemsToQuotation(input: {
  quotationId: string;
  shortlistId: string;
  itemIds?: string[];
}): Promise<ActionResult<{ added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const loaded = await loadShortlistItemsForSeeds(
    actor.supabase,
    input.shortlistId,
    input.itemIds
  );
  if (!loaded.ok) return loaded;
  if (loaded.items.length === 0) {
    return { ok: false, message: "No creators selected to import." };
  }

  const { data: existingRows } = await actor.supabase
    .from("quotation_items")
    .select("source_shortlist_item_id")
    .eq("quotation_id", input.quotationId);

  const pendingItems = filterNewShortlistImportItems(
    loaded.items,
    ((existingRows ?? []) as Array<{ source_shortlist_item_id: string | null }>)
      .map((r) => r.source_shortlist_item_id)
      .filter((id): id is string => Boolean(id))
  );
  if (pendingItems.length === 0) {
    return { ok: false, message: "All selected creators are already on this quotation." };
  }

  const seeds = await buildSeedsFromShortlistItems(actor.supabase, pendingItems);

  const { data: maxRow } = await actor.supabase
    .from("quotation_items")
    .select("sort_order")
    .eq("quotation_id", input.quotationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const startSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const inserted = await insertQuotationSeeds(
    actor.supabase,
    input.quotationId,
    seeds,
    startSort
  );
  if (!inserted.ok) return inserted;

  revalidate(input.quotationId);
  return {
    ok: true,
    data: { added: inserted.data?.inserted ?? 0 },
    message: `Added ${inserted.data?.inserted ?? 0} creator(s).`,
  };
}

/** Per-row shortlist action: append to open quotation or create one. */
export async function addShortlistCreatorsToQuotation(input: {
  shortlistId: string;
  itemIds: string[];
}): Promise<ActionResult<{ quotationId: string; added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  if (!input.itemIds.length) {
    return { ok: false, message: "No creators selected." };
  }

  const open = await findOpenQuotationForShortlist(input.shortlistId);
  if (!open.ok) return open;

  if (open.data?.id) {
    const imported = await importShortlistItemsToQuotation({
      quotationId: open.data.id,
      shortlistId: input.shortlistId,
      itemIds: input.itemIds,
    });
    if (!imported.ok) return imported;
    return {
      ok: true,
      data: { quotationId: open.data.id, added: imported.data?.added ?? 0 },
      message: imported.message,
    };
  }

  const created = await createQuotationFromShortlist(input.shortlistId, {
    itemIds: input.itemIds,
  });
  if (!created.ok) return created;
  return {
    ok: true,
    data: { quotationId: created.data!.id, added: input.itemIds.length },
    message: created.message,
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

  const inserted = await insertQuotationSeeds(
    actor.supabase,
    quotationId,
    creators,
    startSort
  );
  if (!inserted.ok) return inserted;

  revalidate(quotationId);
  return {
    ok: true,
    data: { added: inserted.data?.inserted ?? 0 },
    message: "Creators added.",
  };
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
  af_pct?: number | null;
  deliverables?: QuotationDeliverable[];
}): Promise<
  ActionResult<{
    totals: ReturnType<typeof computeQuotationTotals>;
    fx_rate_to_egp: number;
  }>
> {
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
    afPct: input.af_pct,
    fxRateToEgp: rate,
  });

  const patch: Record<string, unknown> = {
    commercial_input_mode: line.commercial_input_mode,
    cost: line.cost,
    cost_currency: line.cost_currency,
    revenue: line.revenue,
    gp_pct: line.gp_pct,
    gp_value: line.gp_value,
    af_pct: line.af_pct,
    af_value: line.af_value,
    fx_rate_to_egp: line.fx_rate_to_egp,
    cost_egp: line.cost_egp,
    revenue_egp: line.revenue_egp,
    gp_value_egp: line.gp_value_egp,
    af_value_egp: line.af_value_egp,
  };
  if (input.deliverables) patch.deliverables = input.deliverables;

  const { error } = await actor.supabase
    .from("quotation_items")
    .update(patch as never)
    .eq("id", input.item_id);
  if (error) return { ok: false, message: error.message };

  const totals = await recomputeTotals(actor.supabase, input.quotation_id);
  revalidate(input.quotation_id);
  return {
    ok: true,
    data: { totals, fx_rate_to_egp: line.fx_rate_to_egp },
  };
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
  reviewed_by_name?: string | null;
  client_signature_name?: string | null;
  issue_date?: string;
  validity_date?: string | null;
  version?: string;
  department?: string | null;
  change_summary?: string | null;
  status?: Database["public"]["Tables"]["quotations"]["Row"]["status"];
  shared_with_client?: boolean;
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
    "reviewed_by_name",
    "client_signature_name",
    "issue_date",
    "validity_date",
    "version",
    "department",
    "change_summary",
    "status",
    "shared_with_client",
  ] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (input.shared_with_client !== undefined) {
    patch.client_visible = input.shared_with_client;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  if (patch.client_id !== undefined || patch.brand_id !== undefined) {
    const clientId = (patch.client_id as string | null) ?? undefined;
    const brandId = (patch.brand_id as string | null) ?? undefined;
    if (clientId === null || brandId === null) {
      return { ok: false, message: "Client and brand are required." };
    }
  }

  const { error } = await actor.supabase
    .from("quotations")
    .update(patch as never)
    .eq("id", input.id);
  if (error) return { ok: false, message: error.message };

  if (input.version || input.change_summary) {
    await appendQuotationRevision(actor.supabase, {
      quotationId: input.id,
      userId: actor.userId,
      version: (input.version as string) ?? "v1.0",
      changeSummary: input.change_summary ?? "Quotation updated",
    });
  }

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

export async function duplicateQuotationItems(input: {
  quotation_id: string;
  item_ids: string[];
}): Promise<ActionResult<{ duplicated: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  if (!input.item_ids.length) {
    return { ok: false, message: "Select at least one creator to duplicate." };
  }

  const { data: existing, error: loadError } = await actor.supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", input.quotation_id)
    .in("id", input.item_ids);
  if (loadError) return { ok: false, message: loadError.message };

  const rows = (existing ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return { ok: false, message: "No matching creators found." };

  const { data: maxSortRow } = await actor.supabase
    .from("quotation_items")
    .select("sort_order")
    .eq("quotation_id", input.quotation_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sort = Number((maxSortRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const inserts = rows.map((row) => {
    const {
      id: _id,
      created_at: _created,
      updated_at: _updated,
      ...rest
    } = row;
    return { ...rest, quotation_id: input.quotation_id, sort_order: sort++ };
  });

  const { error } = await actor.supabase.from("quotation_items").insert(inserts as never);
  if (error) return { ok: false, message: error.message };

  await recomputeTotals(actor.supabase, input.quotation_id);
  revalidate(input.quotation_id);
  return {
    ok: true,
    data: { duplicated: inserts.length },
    message: `Duplicated ${inserts.length} creator${inserts.length === 1 ? "" : "s"}.`,
  };
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

// ---------------------------------------------------------------------------
// Import helpers (Add creators modal)
// ---------------------------------------------------------------------------
export type ImportCreatorOption = {
  item_id: string;
  label: string;
  platform: string | null;
  followers: number | null;
};

export async function listShortlistsForImport(): Promise<
  ActionResult<{ shortlists: Array<{ id: string; name: string; creator_count: number }> }>
> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const { data, error } = await actor.supabase
    .from("discovery_shortlists")
    .select("id, name, discovery_shortlist_items(count)")
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false, message: error.message };

  const shortlists = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const itemsAgg = row.discovery_shortlist_items as Array<{ count: number }> | undefined;
    return {
      id: row.id as string,
      name: row.name as string,
      creator_count: itemsAgg?.[0]?.count ?? 0,
    };
  });

  return { ok: true, data: { shortlists } };
}

export async function listCampaignsForImport(): Promise<
  ActionResult<{ campaigns: Array<{ id: string; name: string; document_number: string | null }> }>
> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const { data, error } = await actor.supabase
    .from("campaign_headers")
    .select("id, name, document_number")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    data: {
      campaigns: ((data ?? []) as Array<{
        id: string;
        name: string;
        document_number: string | null;
      }>) ?? [],
    },
  };
}

export async function listShortlistImportCreators(
  shortlistId: string
): Promise<ActionResult<{ creators: ImportCreatorOption[] }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const loaded = await loadShortlistItemsForSeeds(actor.supabase, shortlistId);
  if (!loaded.ok) return loaded;

  const resolved = await buildSeedsFromShortlistItems(actor.supabase, loaded.items);
  const creators = loaded.items.map((item, index) => {
    const seed = resolved[index];
    return {
      item_id: item.id,
      label: seed?.creator_name ?? seed?.handle ?? "Creator",
      platform: seed?.platform ?? null,
      followers: seed?.followers ?? null,
    };
  });

  return { ok: true, data: { creators } };
}

export async function listCampaignImportCreators(
  campaignHeaderId: string
): Promise<ActionResult<{ creators: ImportCreatorOption[] }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const { data, error } = await actor.supabase
    .from("campaign_influencers")
    .select("id, influencer_id, influencers: influencer_id(display_name)")
    .eq("campaign_header_id", campaignHeaderId);

  if (error) return { ok: false, message: error.message };

  const creators = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const influencer = row.influencers as { display_name: string | null } | null;
    return {
      item_id: row.id as string,
      label: influencer?.display_name ?? "Creator",
      platform: null,
      followers: null,
    };
  });

  return { ok: true, data: { creators } };
}

export async function addManualQuotationItem(
  quotationId: string,
  input?: { creator_name?: string }
): Promise<ActionResult<{ added: number }>> {
  return addItemsToQuotation(quotationId, [
    {
      creator_name: input?.creator_name?.trim() || "New creator",
      cost_currency: "EGP",
    },
  ]);
}

export async function importCampaignAssignmentsToQuotation(input: {
  quotationId: string;
  assignmentIds: string[];
}): Promise<ActionResult<{ added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  if (!input.assignmentIds.length) {
    return { ok: false, message: "No campaign assignments selected." };
  }

  const { data, error } = await actor.supabase
    .from("campaign_influencers")
    .select("id, influencer_id")
    .in("id", input.assignmentIds);

  if (error) return { ok: false, message: error.message };

  const seeds: QuotationItemSeed[] = ((data ?? []) as Array<{
    id: string;
    influencer_id: string;
  }>).map((row) => ({
    influencer_id: row.influencer_id,
    creator_name: null,
    cost_currency: "EGP",
  }));

  return addItemsToQuotation(input.quotationId, seeds);
}
