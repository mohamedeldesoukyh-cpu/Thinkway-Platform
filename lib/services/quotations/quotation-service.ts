import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildSeedsFromShortlistItems,
  filterNewShortlistImportItems,
  type ShortlistItemForSeed,
} from "@/features/quotations/shortlist-seeds";
import type { Database } from "@/types/database";

import { recomputeQuotationTotals } from "./quotation-commercial-service";
import type { ImportCreatorOption, QuotationItemSeed, QuotationMutationResult } from "./quotation-helpers";
import {
  appendQuotationRevision,
  archiveQuotationRecord,
  duplicateQuotationItemRows,
  fetchCampaignAssignmentsByIds,
  fetchCampaignImportCreators,
  fetchExistingShortlistSourceIds,
  fetchMaxItemSortOrder,
  fetchShortlistHeader,
  findOpenQuotationForShortlistQuery,
  insertQuotationHeaderRecord,
  listCampaignsForImportQuery,
  listShortlistsForImportQuery,
  loadShortlistItemsForSeeds,
  updateQuotationHeaderRecord,
} from "./repositories/quotation-repository";
import {
  buildItemInsertRows,
  insertQuotationItems,
} from "./repositories/quotation-item-repository";

async function insertQuotationHeader(
  supabase: SupabaseClient<Database>,
  userId: string,
  patch: Partial<Database["public"]["Tables"]["quotations"]["Insert"]> & { name: string }
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await insertQuotationHeaderRecord(supabase, userId, patch);
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

async function insertQuotationSeeds(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  seeds: QuotationItemSeed[],
  startSort = 0
): Promise<QuotationMutationResult<{ inserted: number }>> {
  if (!seeds.length) return { ok: true, data: { inserted: 0 } };
  const rows = await buildItemInsertRows(supabase, quotationId, seeds, startSort);
  const { error } = await insertQuotationItems(supabase, rows);
  if (error) return { ok: false, message: error.message };
  await recomputeQuotationTotals(supabase, quotationId);
  return { ok: true, data: { inserted: rows.length } };
}

export async function createBlankQuotation(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: {
    name: string;
    client_id?: string | null;
    brand_id?: string | null;
    campaign_header_id?: string | null;
  }
): Promise<QuotationMutationResult<{ id: string }>> {
  const name = input.name?.trim();
  if (!name) return { ok: false, message: "Quotation name is required." };
  if (!input.client_id || !input.brand_id) {
    return {
      ok: false,
      message: "Client and brand are required to create a quotation.",
    };
  }

  const created = await insertQuotationHeader(supabase, userId, {
    name,
    client_id: input.client_id ?? null,
    brand_id: input.brand_id ?? null,
    campaign_header_id: input.campaign_header_id ?? null,
  });
  if (!created.ok) return created;
  return { ok: true, data: { id: created.id }, message: "Quotation created." };
}

export async function createQuotationFromSelection(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: {
    name?: string;
    creators: QuotationItemSeed[];
    client_id?: string | null;
    brand_id?: string | null;
  }
): Promise<QuotationMutationResult<{ id: string }>> {
  if (!input.creators?.length) {
    return { ok: false, message: "Select at least one creator." };
  }

  const created = await insertQuotationHeader(supabase, userId, {
    name: input.name?.trim() || "Untitled quotation",
    client_id: input.client_id ?? null,
    brand_id: input.brand_id ?? null,
  });
  if (!created.ok) return created;

  const rows = await buildItemInsertRows(supabase, created.id, input.creators, 0);
  const { error } = await insertQuotationItems(supabase, rows);
  if (error) return { ok: false, message: error.message };

  await recomputeQuotationTotals(supabase, created.id);
  return {
    ok: true,
    data: { id: created.id },
    message: `Quotation created with ${rows.length} creator${rows.length === 1 ? "" : "s"}.`,
  };
}

export async function findOpenQuotationForShortlist(
  supabase: SupabaseClient<Database>,
  shortlistId: string
): Promise<QuotationMutationResult<{ id: string | null }>> {
  const { data, error } = await findOpenQuotationForShortlistQuery(supabase, shortlistId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: (data as { id: string } | null)?.id ?? null } };
}

export async function createQuotationFromShortlist(
  supabase: SupabaseClient<Database>,
  userId: string,
  shortlistId: string,
  options?: { itemIds?: string[] }
): Promise<QuotationMutationResult<{ id: string }>> {
  const { data: shortlist, error: slError } = await fetchShortlistHeader(supabase, shortlistId);
  if (slError) return { ok: false, message: slError.message };
  if (!shortlist) return { ok: false, message: "Shortlist not found." };
  const sl = shortlist as {
    id: string;
    name: string;
    client_id: string | null;
    brand_id: string | null;
    campaign_header_id: string | null;
  };

  const { data, error } = await loadShortlistItemsForSeeds(
    supabase,
    shortlistId,
    options?.itemIds
  );
  if (error) return { ok: false, message: error.message };
  const items = (data ?? []) as ShortlistItemForSeed[];
  if (items.length === 0) {
    return { ok: false, message: "No creators to quote on this shortlist." };
  }

  const seeds = await buildSeedsFromShortlistItems(supabase, items);

  const created = await insertQuotationHeader(supabase, userId, {
    name: `Quotation — ${sl.name}`,
    shortlist_id: sl.id,
    client_id: sl.client_id,
    brand_id: sl.brand_id,
    campaign_header_id: sl.campaign_header_id,
  });
  if (!created.ok) return created;

  const inserted = await insertQuotationSeeds(supabase, created.id, seeds, 0);
  if (!inserted.ok) return inserted;

  return {
    ok: true,
    data: { id: created.id },
    message: `Quotation created with ${inserted.data?.inserted ?? seeds.length} creator${
      (inserted.data?.inserted ?? seeds.length) === 1 ? "" : "s"
    }.`,
  };
}

export async function importShortlistItemsToQuotation(
  supabase: SupabaseClient<Database>,
  input: {
    quotationId: string;
    shortlistId: string;
    itemIds?: string[];
  }
): Promise<QuotationMutationResult<{ added: number }>> {
  const { data, error } = await loadShortlistItemsForSeeds(
    supabase,
    input.shortlistId,
    input.itemIds
  );
  if (error) return { ok: false, message: error.message };
  const loadedItems = (data ?? []) as ShortlistItemForSeed[];
  if (loadedItems.length === 0) {
    return { ok: false, message: "No creators selected to import." };
  }

  const { data: existingRows } = await fetchExistingShortlistSourceIds(
    supabase,
    input.quotationId
  );

  const pendingItems = filterNewShortlistImportItems(
    loadedItems,
    ((existingRows ?? []) as Array<{ source_shortlist_item_id: string | null }>)
      .map((r) => r.source_shortlist_item_id)
      .filter((id): id is string => Boolean(id))
  );
  if (pendingItems.length === 0) {
    return { ok: false, message: "All selected creators are already on this quotation." };
  }

  const seeds = await buildSeedsFromShortlistItems(supabase, pendingItems);

  const { data: maxRow } = await fetchMaxItemSortOrder(supabase, input.quotationId);
  const startSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const inserted = await insertQuotationSeeds(supabase, input.quotationId, seeds, startSort);
  if (!inserted.ok) return inserted;

  return {
    ok: true,
    data: { added: inserted.data?.inserted ?? 0 },
    message: `Added ${inserted.data?.inserted ?? 0} creator(s).`,
  };
}

export async function addShortlistCreatorsToQuotation(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { shortlistId: string; itemIds: string[] }
): Promise<QuotationMutationResult<{ quotationId: string; added: number }>> {
  if (!input.itemIds.length) {
    return { ok: false, message: "No creators selected." };
  }

  const open = await findOpenQuotationForShortlist(supabase, input.shortlistId);
  if (!open.ok) return open;

  if (open.data?.id) {
    const imported = await importShortlistItemsToQuotation(supabase, {
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

  const created = await createQuotationFromShortlist(supabase, userId, input.shortlistId, {
    itemIds: input.itemIds,
  });
  if (!created.ok) return created;
  return {
    ok: true,
    data: { quotationId: created.data!.id, added: input.itemIds.length },
    message: created.message,
  };
}

export async function addItemsToQuotation(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  creators: QuotationItemSeed[]
): Promise<QuotationMutationResult<{ added: number }>> {
  if (!creators?.length) return { ok: false, message: "No creators provided." };

  const { data: maxRow } = await fetchMaxItemSortOrder(supabase, quotationId);
  const startSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const inserted = await insertQuotationSeeds(supabase, quotationId, creators, startSort);
  if (!inserted.ok) return inserted;

  return {
    ok: true,
    data: { added: inserted.data?.inserted ?? 0 },
    message: "Creators added.",
  };
}

export async function updateQuotationHeader(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: {
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
  }
): Promise<QuotationMutationResult> {
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

  const { error } = await updateQuotationHeaderRecord(supabase, input.id, patch);
  if (error) return { ok: false, message: error.message };

  if (input.version || input.change_summary) {
    await appendQuotationRevision(supabase, {
      quotationId: input.id,
      userId,
      version: (input.version as string) ?? "v1.0",
      changeSummary: input.change_summary ?? "Quotation updated",
    });
  }

  return { ok: true };
}

export async function duplicateQuotationItems(
  supabase: SupabaseClient<Database>,
  input: { quotation_id: string; item_ids: string[] }
): Promise<QuotationMutationResult<{ duplicated: number }>> {
  if (!input.item_ids.length) {
    return { ok: false, message: "Select at least one creator to duplicate." };
  }

  const result = await duplicateQuotationItemRows(
    supabase,
    input.quotation_id,
    input.item_ids
  );
  if (!result.ok) return { ok: false, message: result.message };

  await recomputeQuotationTotals(supabase, input.quotation_id);
  return {
    ok: true,
    data: { duplicated: result.inserts.length },
    message: `Duplicated ${result.inserts.length} creator${result.inserts.length === 1 ? "" : "s"}.`,
  };
}

export async function archiveQuotation(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<QuotationMutationResult> {
  const { error } = await archiveQuotationRecord(supabase, id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Quotation archived." };
}

export async function listShortlistsForImport(
  supabase: SupabaseClient<Database>
): Promise<
  QuotationMutationResult<{ shortlists: Array<{ id: string; name: string; creator_count: number }> }>
> {
  const { data, error } = await listShortlistsForImportQuery(supabase);
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

export async function listCampaignsForImport(
  supabase: SupabaseClient<Database>
): Promise<
  QuotationMutationResult<{ campaigns: Array<{ id: string; name: string; document_number: string | null }> }>
> {
  const { data, error } = await listCampaignsForImportQuery(supabase);
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
  supabase: SupabaseClient<Database>,
  shortlistId: string
): Promise<QuotationMutationResult<{ creators: ImportCreatorOption[] }>> {
  const { data, error } = await loadShortlistItemsForSeeds(supabase, shortlistId);
  if (error) return { ok: false, message: error.message };
  const items = (data ?? []) as ShortlistItemForSeed[];

  const resolved = await buildSeedsFromShortlistItems(supabase, items);
  const creators = items.map((item, index) => {
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
  supabase: SupabaseClient<Database>,
  campaignHeaderId: string
): Promise<QuotationMutationResult<{ creators: ImportCreatorOption[] }>> {
  const { data, error } = await fetchCampaignImportCreators(supabase, campaignHeaderId);
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
  supabase: SupabaseClient<Database>,
  quotationId: string,
  input?: { creator_name?: string }
): Promise<QuotationMutationResult<{ added: number }>> {
  return addItemsToQuotation(supabase, quotationId, [
    {
      creator_name: input?.creator_name?.trim() || "New creator",
      cost_currency: "EGP",
    },
  ]);
}

export async function importCampaignAssignmentsToQuotation(
  supabase: SupabaseClient<Database>,
  input: { quotationId: string; assignmentIds: string[] }
): Promise<QuotationMutationResult<{ added: number }>> {
  if (!input.assignmentIds.length) {
    return { ok: false, message: "No campaign assignments selected." };
  }

  const { data, error } = await fetchCampaignAssignmentsByIds(
    supabase,
    input.assignmentIds
  );
  if (error) return { ok: false, message: error.message };

  const seeds: QuotationItemSeed[] = ((data ?? []) as Array<{
    id: string;
    influencer_id: string;
  }>).map((row) => ({
    influencer_id: row.influencer_id,
    creator_name: null,
    cost_currency: "EGP",
  }));

  return addItemsToQuotation(supabase, input.quotationId, seeds);
}

export type { QuotationItemSeed, ImportCreatorOption };
