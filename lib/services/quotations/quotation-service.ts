import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildSeedsForShortlistQuotationImport,
  buildSeedsFromShortlistItems,
  type ShortlistItemForSeed,
} from "@/lib/commercial-sync/shortlist-seeds";
import { isCommercialCurrency } from "@/lib/commercial/fx-aggregation";
import { readShortlistDisplayCurrency } from "@/lib/discovery/shortlist-currency";
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
  fetchQuotationItemsByIds,
  fetchShortlistHeader,
  insertQuotationRowsAfter,
  renumberQuotationOptionNumbers,
  syncCollapsePackageOptionNumbers,
  findLatestQuotationForShortlistQuery,
  findEditableQuotationForShortlistQuery,
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
import {
  canGenerateQuotationVersion,
  isQuotationCommercialImmutable,
} from "@/lib/commercial-sync/rules";
import { rejectIfApprovedQuotation, rejectIfApprovedQuotationHeaderPatch } from "./approved-quotation-guard";
import { generateQuotationVersion } from "./quotation-version-service";
import { ensureDiscoveryCreatorsBrowsable, ensureDiscoverySeedsBrowsable } from "@/lib/creators/discovery-browse-eligibility";

async function insertQuotationHeader(
  supabase: SupabaseClient<Database>,
  userId: string,
  patch: Partial<Database["public"]["Tables"]["quotations"]["Insert"]> & { name: string }
): Promise<
  | {
      ok: true;
      id: string;
      serial_number: string | null;
      name: string;
      slug: string | null;
    }
  | { ok: false; message: string }
> {
  const { data, error } = await insertQuotationHeaderRecord(supabase, userId, patch);
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Failed to create quotation." };
  }
  const row = data as {
    id: string;
    serial_number: string | null;
    name: string;
  };
  await appendQuotationRevision(supabase, {
    quotationId: row.id,
    userId,
    version: (patch.version as string) ?? "v1.0",
    changeSummary: "Initial quotation created",
  });
  return {
    ok: true,
    id: row.id,
    serial_number: row.serial_number,
    name: row.name,
    slug: null,
  };
}

async function insertQuotationSeeds(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  seeds: QuotationItemSeed[],
  startSort = 0
): Promise<QuotationMutationResult<{ inserted: number; itemIds: string[] }>> {
  if (!seeds.length) return { ok: true, data: { inserted: 0, itemIds: [] } };
  const rows = await buildItemInsertRows(supabase, quotationId, seeds, startSort);
  const { data, error } = await insertQuotationItems(supabase, rows);
  if (error) return { ok: false, message: error.message };
  await ensureDiscoverySeedsBrowsable(supabase, seeds);
  await syncCollapsePackageOptionNumbers(supabase, quotationId);
  await recomputeQuotationTotals(supabase, quotationId);
  const itemIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  return { ok: true, data: { inserted: rows.length, itemIds } };
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
): Promise<
  QuotationMutationResult<{
    id: string;
    serial_number: string | null;
    name: string;
    slug: string | null;
  }>
> {
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
  return {
    ok: true,
    data: {
      id: created.id,
      serial_number: created.serial_number,
      name: created.name,
      slug: created.slug,
    },
    message: "Quotation created.",
  };
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
): Promise<
  QuotationMutationResult<{
    id: string;
    serial_number: string | null;
    name: string;
    slug: string | null;
  }>
> {
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
    data: {
      id: created.id,
      serial_number: created.serial_number,
      name: created.name,
      slug: created.slug,
    },
    message: `Quotation created with ${rows.length} creator${rows.length === 1 ? "" : "s"}.`,
  };
}

export async function findOpenQuotationForShortlist(
  supabase: SupabaseClient<Database>,
  shortlistId: string
): Promise<QuotationMutationResult<{ id: string | null }>> {
  const { data, error } = await findEditableQuotationForShortlistQuery(supabase, shortlistId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: (data as { id: string } | null)?.id ?? null } };
}

async function resolveTargetQuotationForShortlistImport(
  supabase: SupabaseClient<Database>,
  userId: string,
  shortlistId: string
): Promise<
  QuotationMutationResult<{
    quotationId: string | null;
    versionCreated: boolean;
    versionSerial: string | null;
  }>
> {
  const { data: editable, error: editableError } =
    await findEditableQuotationForShortlistQuery(supabase, shortlistId);
  if (editableError) return { ok: false, message: editableError.message };
  if (editable) {
    return {
      ok: true,
      data: {
        quotationId: (editable as { id: string }).id,
        versionCreated: false,
        versionSerial: (editable as { serial_number: string | null }).serial_number ?? null,
      },
    };
  }

  const { data: latest, error: latestError } = await findLatestQuotationForShortlistQuery(
    supabase,
    shortlistId
  );
  if (latestError) return { ok: false, message: latestError.message };
  if (!latest) {
    return {
      ok: true,
      data: { quotationId: null, versionCreated: false, versionSerial: null },
    };
  }

  const latestRow = latest as {
    id: string;
    status: Database["public"]["Tables"]["quotations"]["Row"]["status"];
  };

  if (!isQuotationCommercialImmutable(latestRow.status)) {
    return {
      ok: true,
      data: {
        quotationId: latestRow.id,
        versionCreated: false,
        versionSerial: (latest as { serial_number: string | null }).serial_number ?? null,
      },
    };
  }

  if (!canGenerateQuotationVersion(latestRow.status)) {
    return {
      ok: false,
      message:
        "The linked quotation is locked and cannot accept new creators. Generate a new quotation version first.",
    };
  }

  const versioned = await generateQuotationVersion(supabase, userId, {
    quotationId: latestRow.id,
    revisionNotes: "Auto-generated to add new shortlist creators.",
  });
  if (!versioned.ok || !versioned.data) {
    return versioned.ok
      ? { ok: false, message: "Failed to create a new quotation version." }
      : versioned;
  }

  return {
    ok: true,
    data: {
      quotationId: versioned.data.newQuotationId,
      versionCreated: true,
      versionSerial: versioned.data.serialNumber,
    },
  };
}

export async function createQuotationFromShortlist(
  supabase: SupabaseClient<Database>,
  userId: string,
  shortlistId: string,
  options?: { itemIds?: string[] }
): Promise<
  QuotationMutationResult<{
    id: string;
    serial_number: string | null;
    name: string;
    slug: string | null;
  }>
> {
  const { data: shortlist, error: slError } = await fetchShortlistHeader(supabase, shortlistId);
  if (slError) return { ok: false, message: slError.message };
  if (!shortlist) return { ok: false, message: "Shortlist not found." };
  const sl = shortlist as {
    id: string;
    name: string;
    client_id: string | null;
    brand_id: string | null;
    campaign_header_id: string | null;
    currency?: string | null;
    metadata?: unknown;
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
  const displayCurrency = readShortlistDisplayCurrency(sl);

  const created = await insertQuotationHeader(supabase, userId, {
    name: `Quotation — ${sl.name}`,
    shortlist_id: sl.id,
    client_id: sl.client_id,
    brand_id: sl.brand_id,
    campaign_header_id: sl.campaign_header_id,
    currency: displayCurrency,
  });
  if (!created.ok) return created;

  const inserted = await insertQuotationSeeds(supabase, created.id, seeds, 0);
  if (!inserted.ok) return inserted;

  return {
    ok: true,
    data: {
      id: created.id,
      serial_number: created.serial_number,
      name: created.name,
      slug: created.slug,
    },
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
  const locked = await rejectIfApprovedQuotation(supabase, input.quotationId);
  if (locked) return locked;

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
  const existingSourceIds = (
    (existingRows ?? []) as Array<{ source_shortlist_item_id: string | null }>
  )
    .map((r) => r.source_shortlist_item_id)
    .filter((id): id is string => Boolean(id));

  const seeds = await buildSeedsForShortlistQuotationImport(
    supabase,
    loadedItems,
    existingSourceIds
  );
  if (seeds.length === 0) {
    return { ok: false, message: "All selected creators are already on this quotation." };
  }

  const { data: maxRow } = await fetchMaxItemSortOrder(supabase, input.quotationId);
  const startSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const inserted = await insertQuotationSeeds(supabase, input.quotationId, seeds, startSort);
  if (!inserted.ok) return inserted;

  const added = inserted.data?.inserted ?? 0;
  const collapseGroups = new Set(
    seeds.map((seed) => seed.collapse_group_id).filter((id): id is string => Boolean(id))
  );
  if (collapseGroups.size > 0) {
    await syncCollapsePackageOptionNumbers(supabase, input.quotationId);
  }

  const { syncOpenClientWorkspaceRosterBestEffort } = await import(
    "@/features/client-workspace/sync-open-roster"
  );
  await syncOpenClientWorkspaceRosterBestEffort(supabase, {
    quotationId: input.quotationId,
    shortlistId: input.shortlistId,
  });

  return {
    ok: true,
    data: { added },
    message: `Added ${added} creator(s).`,
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

  const target = await resolveTargetQuotationForShortlistImport(
    supabase,
    userId,
    input.shortlistId
  );
  if (!target.ok) return target;

  const quotationId = target.data?.quotationId ?? null;
  const versionCreated = target.data?.versionCreated ?? false;
  const versionSerial = target.data?.versionSerial ?? null;

  if (quotationId) {
    const imported = await importShortlistItemsToQuotation(supabase, {
      quotationId,
      shortlistId: input.shortlistId,
      itemIds: input.itemIds,
    });
    if (!imported.ok) return imported;

    const added = imported.data?.added ?? 0;
    const baseMessage =
      imported.message ??
      (added === 1 ? "Added 1 creator." : `Added ${added} creators.`);

    return {
      ok: true,
      data: { quotationId, added },
      message: versionCreated
        ? `${baseMessage} A new quotation version${versionSerial ? ` (${versionSerial})` : ""} was created because the previous quotation was already sent.`
        : baseMessage,
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
): Promise<QuotationMutationResult<{ added: number; itemIds: string[] }>> {
  if (!creators?.length) return { ok: false, message: "No creators provided." };
  const locked = await rejectIfApprovedQuotation(supabase, quotationId);
  if (locked) return locked;

  const { data: maxRow } = await fetchMaxItemSortOrder(supabase, quotationId);
  const startSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const inserted = await insertQuotationSeeds(supabase, quotationId, creators, startSort);
  if (!inserted.ok) return inserted;

  return {
    ok: true,
    data: {
      added: inserted.data?.inserted ?? 0,
      itemIds: inserted.data?.itemIds ?? [],
    },
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
    currency?: string;
  }
): Promise<QuotationMutationResult> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, message: "Name cannot be empty." };
    patch.name = name;
  }
  if (input.currency !== undefined) {
    const code = input.currency.trim().toUpperCase();
    if (!isCommercialCurrency(code)) {
      return { ok: false, message: "Unsupported currency." };
    }
    patch.currency = code;
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

  const lockedHeader = await rejectIfApprovedQuotationHeaderPatch(supabase, input.id, patch);
  if (lockedHeader) return lockedHeader;

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
  const locked = await rejectIfApprovedQuotation(supabase, input.quotation_id);
  if (locked) return locked;

  const result = await duplicateQuotationItemRows(
    supabase,
    input.quotation_id,
    input.item_ids
  );
  if (!result.ok) return { ok: false, message: result.message };

  await recomputeQuotationTotals(supabase, input.quotation_id);
  const isCollapsePackage =
    input.item_ids.length > 1 &&
    result.inserts.length > 0 &&
    result.inserts.every((row) => row.collapse_group_id);
  const optionNumber = result.inserts[0]?.option_number;
  return {
    ok: true,
    data: { duplicated: result.inserts.length },
    message: isCollapsePackage
      ? `Option ${optionNumber ?? 2} added for Collap package.`
      : `Duplicated ${result.inserts.length} creator${result.inserts.length === 1 ? "" : "s"}.`,
  };
}

export async function addQuotationItemOption(
  supabase: SupabaseClient<Database>,
  input: { quotation_id: string; item_id: string }
): Promise<QuotationMutationResult<{ id: string }>> {
  const locked = await rejectIfApprovedQuotation(supabase, input.quotation_id);
  if (locked) return locked;

  const { data: existing, error: loadError } = await fetchQuotationItemsByIds(
    supabase,
    input.quotation_id,
    [input.item_id]
  );
  if (loadError) return { ok: false, message: loadError.message };

  const row = (existing ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return { ok: false, message: "Quotation line not found." };

  const creatorKey =
    (row.unified_id as string | null) ??
    (row.influencer_id as string | null) ??
    (row.profile_id as string | null);
  if (!creatorKey) {
    return { ok: false, message: "Cannot add option without a linked creator profile." };
  }

  const { data: siblings } = await supabase
    .from("quotation_items")
    .select("option_number, unified_id, influencer_id, profile_id")
    .eq("quotation_id", input.quotation_id);

  const sameCreator = ((siblings ?? []) as Array<Record<string, unknown>>).filter((item) => {
    if (row.unified_id && item.unified_id === row.unified_id) return true;
    if (row.influencer_id && item.influencer_id === row.influencer_id) return true;
    if (row.profile_id && item.profile_id === row.profile_id) return true;
    return false;
  });

  const nextOption =
    sameCreator.reduce(
      (max, item) => Math.max(max, Number(item.option_number ?? 1)),
      0
    ) + 1;

  const {
    id: _id,
    created_at: _created,
    updated_at: _updated,
    source_shortlist_item_id: _source,
    ...rest
  } = row;

  const insertResult = await insertQuotationRowsAfter(supabase, input.quotation_id, [
    {
      afterItemId: input.item_id,
      payload: {
        ...rest,
        quotation_id: input.quotation_id,
        option_number: nextOption,
        source_shortlist_item_id: null,
        cost: 0,
        revenue: 0,
        gp_value: 0,
        gp_pct: 0,
        af_value: 0,
        cost_egp: 0,
        revenue_egp: 0,
        gp_value_egp: 0,
        af_value_egp: 0,
      },
    },
  ]);
  if (!insertResult.ok) {
    return { ok: false, message: insertResult.message };
  }

  await renumberQuotationOptionNumbers(supabase, input.quotation_id);

  const insertedId = insertResult.inserts[0]?.id as string | undefined;
  if (!insertedId) {
    return { ok: false, message: "Failed to add option." };
  }

  await recomputeQuotationTotals(supabase, input.quotation_id);
  return {
    ok: true,
    data: { id: insertedId },
    message: `Option ${nextOption} added.`,
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
  input?: { creator_name?: string; platform?: string | null; followers?: number | null }
): Promise<QuotationMutationResult<{ added: number; itemIds: string[] }>> {
  return addItemsToQuotation(supabase, quotationId, [
    {
      creator_name: input?.creator_name?.trim() || "New creator",
      platform: input?.platform?.trim() || null,
      followers: input?.followers ?? null,
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
