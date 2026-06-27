"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CommercialInputMode, Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { computeQuotationTotals } from "./quotation-engine";
import {
  addItemsToQuotation as addItemsToQuotationService,
  addManualQuotationItem as addManualQuotationItemService,
  addShortlistCreatorsToQuotation as addShortlistCreatorsToQuotationService,
  archiveQuotation as archiveQuotationService,
  createBlankQuotation as createBlankQuotationService,
  createQuotationFromSelection as createQuotationFromSelectionService,
  createQuotationFromShortlist as createQuotationFromShortlistService,
  duplicateQuotationItems as duplicateQuotationItemsService,
  findOpenQuotationForShortlist as findOpenQuotationForShortlistService,
  importCampaignAssignmentsToQuotation as importCampaignAssignmentsToQuotationService,
  importShortlistItemsToQuotation as importShortlistItemsToQuotationService,
  listCampaignImportCreators as listCampaignImportCreatorsService,
  listCampaignsForImport as listCampaignsForImportService,
  listShortlistImportCreators as listShortlistImportCreatorsService,
  listShortlistsForImport as listShortlistsForImportService,
  updateQuotationHeader as updateQuotationHeaderService,
} from "@/lib/services/quotations/quotation-service";
import {
  removeQuotationItemWithSync,
  updateQuotationItemCommercials as updateQuotationItemCommercialsService,
} from "@/lib/services/quotations/quotation-commercial-service";
import type {
  ImportCreatorOption,
  QuotationItemSeed,
} from "@/lib/domains/commercial/quotation-types";

import { QUOTATION_PERMISSIONS, QUOTATIONS_LIST_PATH, quotationDetailPath } from "./constants";
import type { ActionResult, QuotationDeliverable } from "./types";

type Supabase = SupabaseClient<Database>;

const SHORTLIST_LIST_PATH = "/discovery/shortlists";

function revalidate(id?: string, shortlistId?: string) {
  revalidatePath(QUOTATIONS_LIST_PATH);
  if (id) revalidatePath(quotationDetailPath(id));
  if (shortlistId) revalidatePath(`${SHORTLIST_LIST_PATH}/${shortlistId}`);
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

export async function createBlankQuotation(input: {
  name: string;
  client_id?: string | null;
  brand_id?: string | null;
  campaign_header_id?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await createBlankQuotationService(actor.supabase, actor.userId, input);
  if (result.ok && result.data?.id) revalidate(result.data.id);
  return result;
}

export async function createQuotationFromSelection(input: {
  name?: string;
  creators: QuotationItemSeed[];
  client_id?: string | null;
  brand_id?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await createQuotationFromSelectionService(actor.supabase, actor.userId, input);
  if (result.ok && result.data?.id) revalidate(result.data.id);
  return result;
}

export async function findOpenQuotationForShortlist(
  shortlistId: string
): Promise<ActionResult<{ id: string | null }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  return findOpenQuotationForShortlistService(actor.supabase, shortlistId);
}

export async function createQuotationFromShortlist(
  shortlistId: string,
  options?: { itemIds?: string[] }
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await createQuotationFromShortlistService(
    actor.supabase,
    actor.userId,
    shortlistId,
    options
  );
  if (result.ok && result.data?.id) revalidate(result.data.id, shortlistId);
  return result;
}

export async function importShortlistItemsToQuotation(input: {
  quotationId: string;
  shortlistId: string;
  itemIds?: string[];
}): Promise<ActionResult<{ added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await importShortlistItemsToQuotationService(actor.supabase, input);
  if (result.ok) revalidate(input.quotationId, input.shortlistId);
  return result;
}

export async function addShortlistCreatorsToQuotation(input: {
  shortlistId: string;
  itemIds: string[];
}): Promise<ActionResult<{ quotationId: string; added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await addShortlistCreatorsToQuotationService(
    actor.supabase,
    actor.userId,
    input
  );
  if (result.ok && result.data?.quotationId) {
    revalidate(result.data.quotationId, input.shortlistId);
  }
  return result;
}

export async function addItemsToQuotation(
  quotationId: string,
  creators: QuotationItemSeed[]
): Promise<ActionResult<{ added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await addItemsToQuotationService(actor.supabase, quotationId, creators);
  if (result.ok) revalidate(quotationId);
  return result;
}

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
  const result = await updateQuotationItemCommercialsService(actor.supabase, actor.userId, input);
  if (result.ok) revalidate(input.quotation_id);
  if (!result.ok) return result;
  return {
    ok: true,
    data: { totals: result.totals, fx_rate_to_egp: result.fx_rate_to_egp },
  };
}

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
  const result = await updateQuotationHeaderService(actor.supabase, actor.userId, input);
  if (result.ok) revalidate(input.id);
  return result;
}

export async function removeQuotationItem(input: {
  item_id: string;
  quotation_id: string;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await removeQuotationItemWithSync(actor.supabase, actor.userId, input);
  if (result.ok) revalidate(input.quotation_id);
  return result.ok
    ? { ok: true, message: "Creator removed." }
    : { ok: false, message: result.message };
}

export async function duplicateQuotationItems(input: {
  quotation_id: string;
  item_ids: string[];
}): Promise<ActionResult<{ duplicated: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await duplicateQuotationItemsService(actor.supabase, input);
  if (result.ok) revalidate(input.quotation_id);
  return result;
}

export async function archiveQuotation(id: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await archiveQuotationService(actor.supabase, id);
  if (result.ok) revalidate(id);
  return result;
}

export async function listShortlistsForImport(): Promise<
  ActionResult<{ shortlists: Array<{ id: string; name: string; creator_count: number }> }>
> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  return listShortlistsForImportService(actor.supabase);
}

export async function listCampaignsForImport(): Promise<
  ActionResult<{ campaigns: Array<{ id: string; name: string; document_number: string | null }> }>
> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  return listCampaignsForImportService(actor.supabase);
}

export async function listShortlistImportCreators(
  shortlistId: string
): Promise<ActionResult<{ creators: ImportCreatorOption[] }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  return listShortlistImportCreatorsService(actor.supabase, shortlistId);
}

export async function listCampaignImportCreators(
  campaignHeaderId: string
): Promise<ActionResult<{ creators: ImportCreatorOption[] }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  return listCampaignImportCreatorsService(actor.supabase, campaignHeaderId);
}

export async function addManualQuotationItem(
  quotationId: string,
  input?: { creator_name?: string }
): Promise<ActionResult<{ added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await addManualQuotationItemService(actor.supabase, quotationId, input);
  if (result.ok) revalidate(quotationId);
  return result;
}

export async function importCampaignAssignmentsToQuotation(input: {
  quotationId: string;
  assignmentIds: string[];
}): Promise<ActionResult<{ added: number }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await importCampaignAssignmentsToQuotationService(actor.supabase, input);
  if (result.ok) revalidate(input.quotationId);
  return result;
}
