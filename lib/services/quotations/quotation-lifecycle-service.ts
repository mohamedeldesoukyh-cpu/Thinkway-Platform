import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCommercialCreatorFromQuoteToCampaign } from "@/lib/creators/crm/activation-helpers";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import {
  executePromoteMasterData,
  writePromoteMasterDataAuditEvents,
} from "@/lib/quotations/promote-master-data";
import type { PromoteMasterDataInput } from "@/lib/domains/commercial/promote-master-data-schema";
import { logQuotationLifecycleEvent } from "@/lib/commercial-sync/audit";
import {
  canCreateCampaignFromQuotation,
} from "@/lib/commercial-sync/rules";
import type { Database } from "@/types/database";

import type { QuotationMutationResult } from "./quotation-helpers";
import {
  copyQuotationItemsToShortlist,
  createCampaignHeaderFromBrand,
  createLinkedShortlist,
  findExistingCampaignAssignment,
  insertCampaignAssignment,
  linkQuotationToCampaign,
  linkQuotationToShortlist,
  linkShortlistToCampaign,
  loadQuotationRow,
  updateQuotationHeaderRecord,
} from "./repositories/quotation-repository";
import { fetchQuotationLifecycleAudit } from "./repositories/quotation-document-repository";

export async function updateQuotationClientBrand(
  supabase: SupabaseClient<Database>,
  input: {
    quotationId: string;
    client_id?: string | null;
    brand_id?: string | null;
    is_temporary_client?: boolean;
    is_temporary_brand?: boolean;
    temporary_client_name?: string | null;
    temporary_brand_name?: string | null;
  }
): Promise<QuotationMutationResult> {
  const patch: Record<string, unknown> = {};

  if (input.is_temporary_client) {
    patch.is_temporary_client = true;
    patch.client_id = null;
    patch.temporary_client_name = input.temporary_client_name?.trim() || null;
    if (!patch.temporary_client_name) {
      return { ok: false, message: "Temporary client name is required." };
    }
    patch.is_temporary_brand = true;
    patch.brand_id = null;
    patch.temporary_brand_name = input.temporary_brand_name?.trim() || null;
    if (!patch.temporary_brand_name) {
      return { ok: false, message: "Temporary brand name is required." };
    }
  } else {
    if (input.client_id !== undefined) patch.client_id = input.client_id;
    if (input.brand_id !== undefined) patch.brand_id = input.brand_id;
    patch.is_temporary_client = false;
    patch.is_temporary_brand = false;
    patch.temporary_client_name = null;
    patch.temporary_brand_name = null;
    if (patch.client_id === null || patch.brand_id === null) {
      return { ok: false, message: "Select both legal entity and brand, or use temporary values." };
    }
  }

  const { error } = await updateQuotationHeaderRecord(supabase, input.quotationId, patch);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function promoteQuotationToMasterData(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: PromoteMasterDataInput
): Promise<
  QuotationMutationResult<{
    clientId: string;
    brandId: string | null;
    case: string;
    shortlistId: string | null;
  }>
> {
  const row = await loadQuotationRow(supabase, input.quotationId);
  if (!row) return { ok: false, message: "Quotation not found." };
  if (!row.is_temporary_client && !row.is_temporary_brand) {
    return { ok: false, message: "This quotation already uses master client/brand data." };
  }

  const oldData = {
    is_temporary_client: row.is_temporary_client,
    is_temporary_brand: row.is_temporary_brand,
    temporary_client_name: row.temporary_client_name,
    temporary_brand_name: row.temporary_brand_name,
    client_id: row.client_id,
    brand_id: row.brand_id,
  };

  const result = await executePromoteMasterData(supabase, userId, input, row);
  if (!result.ok || !result.data) {
    return { ok: false, message: result.message ?? "Promotion failed." };
  }

  const { clientId, brandId, case: promoteCase, auditFlags } = result.data;

  await logQuotationLifecycleEvent(supabase, {
    quotationId: input.quotationId,
    actorId: userId,
    event: "quotation.client_promoted",
    summary: `Promoted quotation to master data (${promoteCase.replaceAll("_", " ")}).`,
    metadata: {
      promoteCase,
      clientId,
      brandId,
      groupId: input.groupId,
      clientMode: input.clientMode,
      brandMode: input.brandMode,
      clientDuplicateOverride: input.clientDuplicateOverride,
      brandDuplicateOverride: input.brandDuplicateOverride,
    },
    oldData,
    newData: {
      client_id: clientId,
      brand_id: brandId,
      is_temporary_client: false,
      is_temporary_brand: false,
    },
  });

  await writePromoteMasterDataAuditEvents(supabase, {
    actorId: userId,
    quotationId: input.quotationId,
    clientId,
    brandId,
    promoteCase,
    auditFlags,
  });

  return {
    ok: true,
    data: {
      clientId,
      brandId,
      case: promoteCase,
      shortlistId: (row.shortlist_id as string | null) ?? null,
    },
    message: "Promoted to master data.",
  };
}

export async function moveQuotationToShortlist(
  supabase: SupabaseClient<Database>,
  userId: string,
  quotationId: string
): Promise<QuotationMutationResult<{ shortlistId: string; serialNumber: string | null }>> {
  const row = await loadQuotationRow(supabase, quotationId);
  if (!row) return { ok: false, message: "Quotation not found." };
  if (row.shortlist_id) {
    return { ok: false, message: "This quotation is already linked to a shortlist." };
  }

  const displayClient =
    (row.client_id ? null : row.temporary_client_name) ?? "Client";
  const slName = `Shortlist — ${row.name ?? displayClient}`;

  const { data: shortlist, error: slError } = await createLinkedShortlist(supabase, {
    name: slName,
    ownerId: userId,
    clientId: (row.client_id as string | null) ?? null,
    brandId: (row.brand_id as string | null) ?? null,
    quotationId,
    description: row.notes ? String(row.notes).slice(0, 500) : null,
  });

  if (slError || !shortlist) {
    return { ok: false, message: slError?.message ?? "Failed to create shortlist." };
  }

  const sl = shortlist as { id: string; serial_number: string | null };

  await linkQuotationToShortlist(supabase, quotationId, sl.id);
  await copyQuotationItemsToShortlist(supabase, quotationId, sl.id, userId);

  await logQuotationLifecycleEvent(supabase, {
    quotationId,
    actorId: userId,
    event: "quotation.shortlist_created",
    summary: `Created linked shortlist ${sl.serial_number ?? sl.id}.`,
    metadata: { shortlistId: sl.id, serialNumber: sl.serial_number },
  });

  return {
    ok: true,
    data: { shortlistId: sl.id, serialNumber: sl.serial_number },
    message: `Shortlist ${sl.serial_number ?? "created"} linked to quotation.`,
  };
}

export async function createCampaignFromQuotation(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { quotationId: string; campaignName?: string | null }
): Promise<
  QuotationMutationResult<{
    campaignId: string;
    documentNumber: string;
    shortlistId: string;
  }>
> {
  const row = await loadQuotationRow(supabase, input.quotationId);
  if (!row) return { ok: false, message: "Quotation not found." };

  const status = row.status as Database["public"]["Tables"]["quotations"]["Row"]["status"];
  if (!canCreateCampaignFromQuotation(status)) {
    return { ok: false, message: "Only approved quotations can create a campaign." };
  }

  if (row.is_temporary_client || row.is_temporary_brand || !row.brand_id) {
    return {
      ok: false,
      message: "Promote temporary client/brand to master data before creating a campaign.",
    };
  }

  let shortlistId = row.shortlist_id as string | null;
  if (!shortlistId) {
    const moved = await moveQuotationToShortlist(supabase, userId, input.quotationId);
    if (!moved.ok || !moved.data?.shortlistId) {
      return { ok: false, message: moved.message ?? "Failed to create linked shortlist." };
    }
    shortlistId = moved.data.shortlistId;
  }

  const campaignName =
    input.campaignName?.trim() ||
    `Campaign — ${row.name ?? row.serial_number ?? "Quotation"}`;

  const created = await createCampaignHeaderFromBrand(supabase, userId, {
    name: campaignName,
    brandId: row.brand_id as string,
    quotationId: input.quotationId,
    shortlistId,
  });

  if (!created.ok) return created;

  const { data: items } = await supabase
    .from("quotation_items")
    .select("id, influencer_id, profile_id, unified_id, source_shortlist_item_id")
    .eq("quotation_id", input.quotationId);

  let assigned = 0;
  for (const item of (items ?? []) as Array<{
    id: string;
    influencer_id: string | null;
    profile_id: string | null;
    unified_id: string | null;
    source_shortlist_item_id: string | null;
  }>) {
    let influencerId = item.influencer_id;
    if (!influencerId && item.profile_id) {
      const promotion = await promoteDiscoveredProfileToInfluencer(
        supabase,
        item.profile_id,
        userId
      );
      if (promotion.ok) influencerId = promotion.influencerId;
    }
    if (!influencerId) continue;

    const { data: existing } = await findExistingCampaignAssignment(
      supabase,
      created.id,
      influencerId
    );

    if (existing?.id) continue;

    const assignmentInsert = await insertCampaignAssignment(supabase, {
      campaignId: created.id,
      influencerId,
      shortlistId,
      sourceShortlistItemId: item.source_shortlist_item_id,
      userId,
    });

    if (assignmentInsert.error) {
      continue;
    }

    const campaignInfluencerId = (assignmentInsert.data?.id as string | undefined) ?? null;
    if (campaignInfluencerId) {
      try {
        // Dual-event: quotation_operational (audit) + campaign_assignment (deduped if 2B.1 already wrote).
        await ensureCommercialCreatorFromQuoteToCampaign(supabase, {
          influencerId,
          quotationId: input.quotationId,
          campaignInfluencerId,
          actorId: userId,
          bypassRoleCheck: true,
          metadata: {
            path: "createCampaignFromQuotation",
            campaignId: created.id,
          },
        });
      } catch (error) {
        console.warn(
          "[creator-crm] quote→campaign dual-event failed",
          error instanceof Error ? error.message : error,
          campaignInfluencerId
        );
      }
    }

    assigned += 1;
  }

  await linkQuotationToCampaign(supabase, input.quotationId, created.id);
  await linkShortlistToCampaign(supabase, shortlistId, created.id);

  await logQuotationLifecycleEvent(supabase, {
    quotationId: input.quotationId,
    actorId: userId,
    event: "quotation.campaign_created",
    summary: `Campaign ${created.document_number} created from approved quotation.`,
    metadata: {
      campaignId: created.id,
      documentNumber: created.document_number,
      shortlistId,
      assignments: assigned,
    },
  });

  return {
    ok: true,
    data: {
      campaignId: created.id,
      documentNumber: created.document_number,
      shortlistId,
    },
    message: `Campaign ${created.document_number} created with ${assigned} vendor assignment(s).`,
  };
}

export async function getQuotationLifecycleActivity(
  supabase: SupabaseClient<Database>,
  quotationId: string
): Promise<
  QuotationMutationResult<{
    events: Array<{
      id: string;
      action: string;
      summary: string;
      created_at: string;
      actor_name: string | null;
    }>;
  }>
> {
  const { data, error } = await fetchQuotationLifecycleAudit(supabase, quotationId);
  if (error) return { ok: false, message: error.message };

  const events = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    const actor = row.actor as { full_name: string | null } | null;
    return {
      id: row.id as string,
      action: row.action as string,
      summary: String(meta.summary ?? row.action),
      created_at: row.created_at as string,
      actor_name: actor?.full_name ?? null,
    };
  });

  return { ok: true, data: { events } };
}
