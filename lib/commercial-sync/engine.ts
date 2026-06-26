import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildSeedsFromShortlistItems,
  type ShortlistItemForSeed,
} from "@/features/quotations/shortlist-seeds";
import type { Database, QuotationStatus } from "@/types/database";

import { logQuotationLifecycleEvent } from "./audit";
import { isCommercialSyncEnabled } from "./rules";

type Supabase = SupabaseClient<Database>;

const syncLocks = new Set<string>();

function lockKey(quotationId: string, shortlistId: string): string {
  return `${quotationId}:${shortlistId}`;
}

async function withSyncLock(
  quotationId: string,
  shortlistId: string,
  fn: () => Promise<void>
) {
  const key = lockKey(quotationId, shortlistId);
  if (syncLocks.has(key)) return;
  syncLocks.add(key);
  try {
    await fn();
  } finally {
    syncLocks.delete(key);
  }
}

type LinkedPair = {
  quotationId: string;
  shortlistId: string;
  quotationStatus: QuotationStatus;
};

async function loadLinkedPair(
  supabase: Supabase,
  opts: { quotationId?: string; shortlistId?: string }
): Promise<LinkedPair | null> {
  if (opts.quotationId) {
    const { data } = await supabase
      .from("quotations")
      .select("id, shortlist_id, status")
      .eq("id", opts.quotationId)
      .maybeSingle();
    const row = data as {
      id: string;
      shortlist_id: string | null;
      status: QuotationStatus;
    } | null;
    if (!row?.shortlist_id) return null;
    return {
      quotationId: row.id,
      shortlistId: row.shortlist_id,
      quotationStatus: row.status,
    };
  }

  if (opts.shortlistId) {
    const { data: sl } = await supabase
      .from("discovery_shortlists")
      .select("id, quotation_id")
      .eq("id", opts.shortlistId)
      .maybeSingle();
    const shortlist = sl as { id: string; quotation_id: string | null } | null;
    if (!shortlist?.quotation_id) return null;

    const { data: q } = await supabase
      .from("quotations")
      .select("id, shortlist_id, status")
      .eq("id", shortlist.quotation_id)
      .maybeSingle();
    const quotation = q as {
      id: string;
      shortlist_id: string | null;
      status: QuotationStatus;
    } | null;
    if (!quotation) return null;
    return {
      quotationId: quotation.id,
      shortlistId: shortlist.id,
      quotationStatus: quotation.status,
    };
  }

  return null;
}

type ShortlistCommercialRow = {
  id: string;
  influencer_id: string | null;
  profile_id: string | null;
  unified_id: string | null;
  commercial_input_mode: Database["public"]["Tables"]["discovery_shortlist_items"]["Row"]["commercial_input_mode"];
  cost: number | null;
  cost_currency: string | null;
  gp_pct: number | null;
  revenue: number | null;
  gp_value: number | null;
  deliverables: unknown;
  sort_order: number;
};

type QuotationCommercialRow = {
  id: string;
  source_shortlist_item_id: string | null;
  influencer_id: string | null;
  profile_id: string | null;
  unified_id: string | null;
  creator_name: string | null;
  platform: string | null;
  handle: string | null;
  followers: number | null;
  engagement_rate: number | null;
  country_code: string | null;
  deliverables: unknown;
  commercial_input_mode: Database["public"]["Tables"]["quotation_items"]["Row"]["commercial_input_mode"];
  cost: number;
  cost_currency: string;
  revenue: number;
  gp_pct: number;
  gp_value: number;
  af_pct: number;
  af_value: number;
  fx_rate_to_egp: number;
  cost_egp: number;
  revenue_egp: number;
  gp_value_egp: number;
  af_value_egp: number;
  sort_order: number;
};

function commercialPatchFromShortlistItem(item: ShortlistCommercialRow) {
  return {
    commercial_input_mode: item.commercial_input_mode,
    cost: item.cost ?? 0,
    cost_currency: item.cost_currency ?? "EGP",
    revenue: item.revenue ?? 0,
    gp_pct: item.gp_pct ?? 0,
    gp_value: item.gp_value ?? 0,
    fx_rate_to_egp: 1,
    cost_egp: item.cost_egp ?? 0,
    revenue_egp: item.revenue_egp ?? 0,
    gp_value_egp: item.gp_value_egp ?? 0,
    deliverables: item.deliverables,
  };
}

function commercialPatchFromQuotationItem(item: QuotationCommercialRow) {
  return {
    commercial_input_mode: item.commercial_input_mode,
    cost: item.cost,
    cost_currency: item.cost_currency,
    revenue: item.revenue,
    gp_pct: item.gp_pct,
    gp_value: item.gp_value,
    fx_rate_to_egp: item.fx_rate_to_egp,
    cost_egp: item.cost_egp,
    revenue_egp: item.revenue_egp,
    gp_value_egp: item.gp_value_egp,
    deliverables: item.deliverables,
    commercial_updated_at: new Date().toISOString(),
  };
}

/** Shortlist creator/commercial change → linked quotation (draft / under review only). */
export async function syncShortlistChangeToQuotation(
  supabase: Supabase,
  input: {
    shortlistId: string;
    actorId: string;
    shortlistItemId?: string;
    removedShortlistItemId?: string;
  }
) {
  const pair = await loadLinkedPair(supabase, { shortlistId: input.shortlistId });
  if (!pair || !isCommercialSyncEnabled(pair.quotationStatus)) return;

  await withSyncLock(pair.quotationId, pair.shortlistId, async () => {
    if (input.removedShortlistItemId) {
      await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", pair.quotationId)
        .eq("source_shortlist_item_id", input.removedShortlistItemId);

      await logQuotationLifecycleEvent(supabase, {
        quotationId: pair.quotationId,
        actorId: input.actorId,
        event: "quotation.creator_removed",
        summary: "Creator removed from linked shortlist and synced to quotation.",
        metadata: { shortlistItemId: input.removedShortlistItemId },
      });
      return;
    }

    if (!input.shortlistItemId) return;

    const { data: slItem } = await supabase
      .from("discovery_shortlist_items")
      .select(
        "id, influencer_id, profile_id, unified_id, commercial_input_mode, cost, cost_currency, gp_pct, revenue, gp_value, cost_egp, revenue_egp, gp_value_egp, deliverables, sort_order"
      )
      .eq("id", input.shortlistItemId)
      .maybeSingle();

    const item = slItem as ShortlistCommercialRow | null;
    if (!item) return;

    const { data: existing } = await supabase
      .from("quotation_items")
      .select("id")
      .eq("quotation_id", pair.quotationId)
      .eq("source_shortlist_item_id", item.id)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("quotation_items")
        .update(commercialPatchFromShortlistItem(item) as never)
        .eq("id", (existing as { id: string }).id);

      await logQuotationLifecycleEvent(supabase, {
        quotationId: pair.quotationId,
        actorId: input.actorId,
        event: "quotation.commercial_updated",
        summary: "Commercials synced from shortlist to quotation.",
        metadata: { shortlistItemId: item.id },
      });
      return;
    }

    const seeds = await buildSeedsFromShortlistItems(supabase, [item as ShortlistItemForSeed]);
    const seed = seeds[0];
    if (!seed) return;

    const { data: maxRow } = await supabase
      .from("quotation_items")
      .select("sort_order")
      .eq("quotation_id", pair.quotationId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = Number((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

    await supabase.from("quotation_items").insert({
      quotation_id: pair.quotationId,
      influencer_id: seed.influencer_id ?? null,
      profile_id: seed.profile_id ?? null,
      unified_id: seed.unified_id ?? null,
      source_shortlist_item_id: item.id,
      creator_name: seed.creator_name ?? null,
      platform: seed.platform ?? null,
      handle: seed.handle ?? null,
      followers: seed.followers ?? null,
      engagement_rate: seed.engagement_rate ?? null,
      country_code: seed.country_code ?? null,
      deliverables: (seed.deliverables ?? []) as never,
      commercial_input_mode: item.commercial_input_mode,
      cost: item.cost ?? 0,
      cost_currency: item.cost_currency ?? "EGP",
      revenue: item.revenue ?? 0,
      gp_pct: item.gp_pct ?? 0,
      gp_value: item.gp_value ?? 0,
      af_pct: seed.af_pct ?? 0,
      af_value: 0,
      fx_rate_to_egp: item.cost_egp != null ? 1 : 1,
      cost_egp: item.cost_egp ?? 0,
      revenue_egp: item.revenue_egp ?? 0,
      gp_value_egp: item.gp_value_egp ?? 0,
      af_value_egp: 0,
      sort_order: sortOrder,
    } as never);

    await logQuotationLifecycleEvent(supabase, {
      quotationId: pair.quotationId,
      actorId: input.actorId,
      event: "quotation.creator_added",
      summary: "Creator added on shortlist and synced to quotation.",
      metadata: { shortlistItemId: item.id },
    });
  });
}

/** Quotation commercial / deliverable change → linked shortlist item. */
export async function syncQuotationChangeToShortlist(
  supabase: Supabase,
  input: {
    quotationId: string;
    actorId: string;
    quotationItemId: string;
    event?: "commercial" | "deliverables" | "remove";
  }
) {
  const pair = await loadLinkedPair(supabase, { quotationId: input.quotationId });
  if (!pair || !isCommercialSyncEnabled(pair.quotationStatus)) return;

  await withSyncLock(pair.quotationId, pair.shortlistId, async () => {
    if (input.event === "remove") {
      const { data: qItem } = await supabase
        .from("quotation_items")
        .select("source_shortlist_item_id")
        .eq("id", input.quotationItemId)
        .maybeSingle();
      const sourceId = (qItem as { source_shortlist_item_id: string | null } | null)
        ?.source_shortlist_item_id;
      if (sourceId) {
        await supabase.from("discovery_shortlist_items").delete().eq("id", sourceId);
      }
      await logQuotationLifecycleEvent(supabase, {
        quotationId: pair.quotationId,
        actorId: input.actorId,
        event: "quotation.creator_removed",
        summary: "Creator removed from quotation and synced to shortlist.",
        metadata: { quotationItemId: input.quotationItemId },
      });
      return;
    }

    const { data: qRow } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("id", input.quotationItemId)
      .maybeSingle();

    const item = qRow as QuotationCommercialRow | null;
    if (!item) return;

    if (item.source_shortlist_item_id) {
      await supabase
        .from("discovery_shortlist_items")
        .update(commercialPatchFromQuotationItem(item) as never)
        .eq("id", item.source_shortlist_item_id);

      await logQuotationLifecycleEvent(supabase, {
        quotationId: pair.quotationId,
        actorId: input.actorId,
        event:
          input.event === "deliverables"
            ? "quotation.deliverables_updated"
            : "quotation.commercial_updated",
        summary: "Quotation line synced to linked shortlist.",
        metadata: { quotationItemId: item.id, shortlistItemId: item.source_shortlist_item_id },
      });
      return;
    }

    const { data: slItem, error } = await supabase
      .from("discovery_shortlist_items")
      .insert({
        shortlist_id: pair.shortlistId,
        influencer_id: item.influencer_id,
        profile_id: item.profile_id,
        unified_id: item.unified_id,
        deliverables: item.deliverables as never,
        commercial_input_mode: item.commercial_input_mode,
        cost: item.cost,
        cost_currency: item.cost_currency,
        revenue: item.revenue,
        gp_pct: item.gp_pct,
        gp_value: item.gp_value,
        cost_egp: item.cost_egp,
        revenue_egp: item.revenue_egp,
        gp_value_egp: item.gp_value_egp,
        sort_order: item.sort_order,
      } as never)
      .select("id")
      .single();

    if (error || !slItem) return;

    await supabase
      .from("quotation_items")
      .update({ source_shortlist_item_id: (slItem as { id: string }).id } as never)
      .eq("id", item.id);

    await logQuotationLifecycleEvent(supabase, {
      quotationId: pair.quotationId,
      actorId: input.actorId,
      event: "quotation.creator_added",
      summary: "Quotation creator linked to shortlist during sync.",
      metadata: {
        quotationItemId: item.id,
        shortlistItemId: (slItem as { id: string }).id,
      },
    });
  });
}

export { isCommercialSyncEnabled, isQuotationCommercialImmutable } from "./rules";
