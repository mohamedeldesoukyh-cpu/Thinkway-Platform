"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { logQuotationLifecycleEvent } from "@/lib/commercial-sync/audit";
import {
  canCreateCampaignFromQuotation,
  canGenerateQuotationVersion,
  formatVersionedQuotationSerial,
  stripQuotationVersionSuffix,
} from "@/lib/commercial-sync/rules";
import { promoteDiscoveredProfileToInfluencer } from "@/features/discovery/shortlists/promote";
import { computeQuotationTotals } from "@/features/quotations/quotation-engine";
import {
  QUOTATION_PERMISSIONS,
  QUOTATIONS_LIST_PATH,
  quotationDetailPath,
} from "@/features/quotations/constants";
import { formatQuotationTermsText } from "@/features/quotations/quotation-default-terms";
import { defaultValidityDateFromIssue } from "@/features/quotations/quotation-validity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionResult } from "./types";

type Supabase = SupabaseClient<Database>;

const SHORTLIST_LIST = "/discovery/shortlists";

function revalidateQuotation(id: string, shortlistId?: string | null, campaignId?: string | null) {
  revalidatePath(QUOTATIONS_LIST_PATH);
  revalidatePath(quotationDetailPath(id));
  if (shortlistId) revalidatePath(`${SHORTLIST_LIST}/${shortlistId}`);
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
}

async function getActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string; roleSlug: string | null }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in adminAuth) return { ok: false, message: auth.error };
    return { ok: true, supabase, userId: adminAuth.userId, roleSlug: adminAuth.roleSlug };
  }
  return { ok: true, supabase, userId: auth.userId, roleSlug: auth.roleSlug };
}

async function requireMasterDataPromote(
  supabase: Supabase
): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const auth = await requirePermission(supabase, "clients.write");
  if ("error" in auth) {
    return {
      ok: false,
      message: "Only Admin, Director, or Manager roles can promote to master data.",
    };
  }
  return { ok: true, userId: auth.userId };
}

async function loadQuotationRow(supabase: Supabase, id: string) {
  const { data, error } = await supabase
    .from("quotations")
    .select(
      `id, name, status, serial_number, shortlist_id, client_id, brand_id, campaign_header_id,
       notes, terms, issue_date, validity_date, version, department, currency,
       is_temporary_client, is_temporary_brand, temporary_client_name, temporary_brand_name,
       parent_quotation_id, version_number, revision_notes, total_cost_egp, total_revenue_egp,
       total_gp_value_egp, total_gp_pct, total_af_egp, total_agency_margin_egp, gp_target_pct`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

async function copyQuotationItems(
  supabase: Supabase,
  sourceQuotationId: string,
  targetQuotationId: string
) {
  const { data: items } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", sourceQuotationId)
    .order("sort_order", { ascending: true });

  if (!items?.length) return;

  const inserts = (items as Array<Record<string, unknown>>).map((row) => {
    const {
      id: _id,
      quotation_id: _q,
      created_at: _c,
      updated_at: _u,
      source_shortlist_item_id: _s,
      ...rest
    } = row;
    return { ...rest, quotation_id: targetQuotationId, source_shortlist_item_id: null };
  });

  await supabase.from("quotation_items").insert(inserts as never);
}

async function copyQuotationItemsToShortlist(
  supabase: Supabase,
  quotationId: string,
  shortlistId: string,
  userId: string
) {
  const { data: items } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: true });

  for (const raw of (items ?? []) as Array<Record<string, unknown>>) {
    const { data: slItem, error } = await supabase
      .from("discovery_shortlist_items")
      .insert({
        shortlist_id: shortlistId,
        influencer_id: raw.influencer_id ?? null,
        profile_id: raw.profile_id ?? null,
        unified_id: raw.unified_id ?? null,
        notes: null,
        added_by: userId,
        commercial_input_mode: raw.commercial_input_mode,
        cost: raw.cost,
        cost_currency: raw.cost_currency,
        revenue: raw.revenue,
        gp_pct: raw.gp_pct,
        gp_value: raw.gp_value,
        cost_egp: raw.cost_egp,
        revenue_egp: raw.revenue_egp,
        gp_value_egp: raw.gp_value_egp,
        deliverables: raw.deliverables,
        sort_order: raw.sort_order,
      } as never)
      .select("id")
      .single();

    if (error || !slItem) continue;

    await supabase
      .from("quotation_items")
      .update({ source_shortlist_item_id: (slItem as { id: string }).id } as never)
      .eq("id", raw.id as string);
  }
}

export async function updateQuotationClientBrand(input: {
  quotationId: string;
  client_id?: string | null;
  brand_id?: string | null;
  is_temporary_client?: boolean;
  is_temporary_brand?: boolean;
  temporary_client_name?: string | null;
  temporary_brand_name?: string | null;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

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

  const { error } = await actor.supabase
    .from("quotations")
    .update(patch as never)
    .eq("id", input.quotationId);

  if (error) return { ok: false, message: error.message };
  revalidateQuotation(input.quotationId);
  return { ok: true };
}

export async function promoteQuotationToMasterData(input: {
  quotationId: string;
  groupId: string;
  agencyOrDirect?: "agency" | "direct" | "hybrid";
}): Promise<ActionResult<{ clientId: string; brandId: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const promoteAuth = await requireMasterDataPromote(actor.supabase);
  if (!promoteAuth.ok) return promoteAuth;

  const row = await loadQuotationRow(actor.supabase, input.quotationId);
  if (!row) return { ok: false, message: "Quotation not found." };
  if (!row.is_temporary_client && !row.is_temporary_brand) {
    return { ok: false, message: "This quotation already uses master client/brand data." };
  }

  const clientName = String(row.temporary_client_name ?? "").trim();
  const brandName = String(row.temporary_brand_name ?? "").trim();
  if (!clientName || !brandName) {
    return { ok: false, message: "Temporary client and brand names are required to promote." };
  }

  const { data: client, error: clientError } = await actor.supabase
    .from("clients")
    .insert({
      group_id: input.groupId,
      name: clientName,
      legal_name: clientName,
      status: "prospect",
      agency_or_direct: input.agencyOrDirect ?? "agency",
      created_by: actor.userId,
    } as never)
    .select("id, group_id")
    .single();

  if (clientError || !client) {
    return { ok: false, message: clientError?.message ?? "Failed to create legal entity." };
  }

  const clientRow = client as { id: string; group_id: string };

  const { data: brand, error: brandError } = await actor.supabase
    .from("brands")
    .insert({
      client_id: clientRow.id,
      group_id: clientRow.group_id,
      name: brandName,
      currency_code: (row.currency as string) ?? "EGP",
      created_by: actor.userId,
    } as never)
    .select("id")
    .single();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Failed to create brand." };
  }

  const brandId = (brand as { id: string }).id;

  await actor.supabase
    .from("quotations")
    .update({
      client_id: clientRow.id,
      brand_id: brandId,
      is_temporary_client: false,
      is_temporary_brand: false,
      temporary_client_name: null,
      temporary_brand_name: null,
    } as never)
    .eq("id", input.quotationId);

  if (row.shortlist_id) {
    await actor.supabase
      .from("discovery_shortlists")
      .update({ client_id: clientRow.id, brand_id: brandId } as never)
      .eq("id", row.shortlist_id as string);
  }

  await logQuotationLifecycleEvent(actor.supabase, {
    quotationId: input.quotationId,
    actorId: actor.userId,
    event: "quotation.client_promoted",
    summary: `Promoted temporary client "${clientName}" and brand "${brandName}" to master data.`,
    metadata: { clientId: clientRow.id, brandId },
  });

  revalidateQuotation(input.quotationId, row.shortlist_id as string | null);
  return {
    ok: true,
    data: { clientId: clientRow.id, brandId },
    message: "Promoted to master data.",
  };
}

export async function moveQuotationToShortlist(
  quotationId: string
): Promise<ActionResult<{ shortlistId: string; serialNumber: string | null }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const row = await loadQuotationRow(actor.supabase, quotationId);
  if (!row) return { ok: false, message: "Quotation not found." };
  if (row.shortlist_id) {
    return { ok: false, message: "This quotation is already linked to a shortlist." };
  }

  const displayClient =
    (row.client_id ? null : row.temporary_client_name) ?? "Client";
  const slName = `Shortlist — ${row.name ?? displayClient}`;

  const { data: shortlist, error: slError } = await actor.supabase
    .from("discovery_shortlists")
    .insert({
      name: slName,
      owner_id: actor.userId,
      created_by: actor.userId,
      status: "draft",
      visibility: "private",
      client_id: (row.client_id as string | null) ?? null,
      brand_id: (row.brand_id as string | null) ?? null,
      quotation_id: quotationId,
      description: row.notes ? String(row.notes).slice(0, 500) : null,
    } as never)
    .select("id, serial_number")
    .single();

  if (slError || !shortlist) {
    return { ok: false, message: slError?.message ?? "Failed to create shortlist." };
  }

  const sl = shortlist as { id: string; serial_number: string | null };

  await actor.supabase
    .from("quotations")
    .update({ shortlist_id: sl.id } as never)
    .eq("id", quotationId);

  await copyQuotationItemsToShortlist(actor.supabase, quotationId, sl.id, actor.userId);

  await logQuotationLifecycleEvent(actor.supabase, {
    quotationId,
    actorId: actor.userId,
    event: "quotation.shortlist_created",
    summary: `Created linked shortlist ${sl.serial_number ?? sl.id}.`,
    metadata: { shortlistId: sl.id, serialNumber: sl.serial_number },
  });

  revalidateQuotation(quotationId, sl.id);
  return {
    ok: true,
    data: { shortlistId: sl.id, serialNumber: sl.serial_number },
    message: `Shortlist ${sl.serial_number ?? "created"} linked to quotation.`,
  };
}

async function resolveMaxVersionNumber(
  supabase: Supabase,
  baseSerial: string,
  rootId: string
): Promise<number> {
  const { data } = await supabase
    .from("quotations")
    .select("version_number, serial_number")
    .or(`id.eq.${rootId},parent_quotation_id.eq.${rootId}`);

  let max = 1;
  for (const row of (data ?? []) as Array<{ version_number: number; serial_number: string | null }>) {
    if (stripQuotationVersionSuffix(row.serial_number) === baseSerial) {
      max = Math.max(max, row.version_number ?? 1);
    }
  }
  return max;
}

export async function generateQuotationVersion(input: {
  quotationId: string;
  revisionNotes?: string | null;
}): Promise<ActionResult<{ newQuotationId: string; versionNumber: number; serialNumber: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const row = await loadQuotationRow(actor.supabase, input.quotationId);
  if (!row) return { ok: false, message: "Quotation not found." };

  const status = row.status as Database["public"]["Tables"]["quotations"]["Row"]["status"];
  if (!canGenerateQuotationVersion(status)) {
    return {
      ok: false,
      message: "New versions can only be generated after the quotation is sent or approved.",
    };
  }

  const baseSerial = stripQuotationVersionSuffix(row.serial_number as string | null);
  if (!baseSerial) {
    return { ok: false, message: "Quotation serial is missing; cannot generate version." };
  }

  const rootId = (row.parent_quotation_id as string | null) ?? (row.id as string);
  const nextVersion = (await resolveMaxVersionNumber(actor.supabase, baseSerial, rootId)) + 1;
  const versionSerial = formatVersionedQuotationSerial(baseSerial, nextVersion);
  const issueDate = new Date().toISOString().slice(0, 10);

  const { data: created, error } = await actor.supabase
    .from("quotations")
    .insert({
      serial_number: versionSerial,
      name: `${row.name} (V${nextVersion})`,
      status: "draft",
      parent_quotation_id: row.id as string,
      version_number: nextVersion,
      revision_notes: input.revisionNotes?.trim() || null,
      shortlist_id: row.shortlist_id ?? null,
      client_id: row.client_id ?? null,
      brand_id: row.brand_id ?? null,
      campaign_header_id: row.campaign_header_id ?? null,
      is_temporary_client: row.is_temporary_client ?? false,
      is_temporary_brand: row.is_temporary_brand ?? false,
      temporary_client_name: row.temporary_client_name ?? null,
      temporary_brand_name: row.temporary_brand_name ?? null,
      owner_id: actor.userId,
      created_by: actor.userId,
      currency: row.currency ?? "EGP",
      notes: row.notes ?? null,
      terms: row.terms ?? formatQuotationTermsText(),
      issue_date: issueDate,
      validity_date: defaultValidityDateFromIssue(issueDate),
      version: `v${nextVersion}.0`,
      department: row.department ?? "Influencer Marketing",
      gp_target_pct: row.gp_target_pct ?? 25,
    } as never)
    .select("id, serial_number")
    .single();

  if (error || !created) {
    return { ok: false, message: error?.message ?? "Failed to create quotation version." };
  }

  const newId = (created as { id: string }).id;
  await copyQuotationItems(actor.supabase, input.quotationId, newId);

  const { data: itemRows } = await actor.supabase
    .from("quotation_items")
    .select("cost_egp, revenue_egp, gp_value_egp, af_value_egp")
    .eq("quotation_id", newId);

  const totals = computeQuotationTotals(
    (itemRows ?? []).map((r) => ({
      cost_egp: Number((r as { cost_egp: number }).cost_egp ?? 0),
      revenue_egp: Number((r as { revenue_egp: number }).revenue_egp ?? 0),
      gp_value_egp: Number((r as { gp_value_egp: number }).gp_value_egp ?? 0),
      af_value_egp: Number((r as { af_value_egp: number }).af_value_egp ?? 0),
    }))
  );

  await actor.supabase
    .from("quotations")
    .update({
      total_cost_egp: totals.totalCostEgp,
      total_revenue_egp: totals.totalRevenueEgp,
      total_gp_value_egp: totals.totalGpValueEgp,
      total_gp_pct: totals.totalGpPct,
      total_af_egp: totals.totalAfValueEgp,
      total_agency_margin_egp: totals.totalAgencyMarginEgp,
    } as never)
    .eq("id", newId);

  await actor.supabase.from("quotation_version_history").insert({
    quotation_id: newId,
    parent_quotation_id: input.quotationId,
    version_number: nextVersion,
    serial_number: versionSerial,
    revision_notes: input.revisionNotes?.trim() || null,
    created_by: actor.userId,
    metadata: { sourceStatus: status },
  } as never);

  await actor.supabase.from("quotation_revisions").insert({
    quotation_id: newId,
    version: `v${nextVersion}.0`,
    updated_by: actor.userId,
    change_summary: input.revisionNotes?.trim() || `Generated version V${nextVersion}`,
  } as never);

  await logQuotationLifecycleEvent(actor.supabase, {
    quotationId: input.quotationId,
    actorId: actor.userId,
    event: "quotation.version_created",
    summary: `Generated quotation version ${versionSerial}.`,
    metadata: { newQuotationId: newId, versionNumber: nextVersion },
  });

  revalidateQuotation(input.quotationId);
  revalidateQuotation(newId, row.shortlist_id as string | null);

  return {
    ok: true,
    data: {
      newQuotationId: newId,
      versionNumber: nextVersion,
      serialNumber: versionSerial,
    },
    message: `Version ${versionSerial} created as draft.`,
  };
}

async function createCampaignHeaderFromBrand(
  supabase: Supabase,
  userId: string,
  input: { name: string; brandId: string; quotationId: string; shortlistId: string | null }
): Promise<{ ok: true; id: string; document_number: string } | { ok: false; message: string }> {
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(
      "id, client_id, group_id, category_id, subcategory_id, vr_rate_id, currency_code, client:clients(agency_or_direct)"
    )
    .eq("id", input.brandId)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Brand not found." };
  }

  const brandRow = brand as unknown as {
    id: string;
    client_id: string;
    group_id: string;
    category_id: string | null;
    subcategory_id: string | null;
    vr_rate_id: string | null;
    currency_code: string;
    client: { agency_or_direct: string | null } | null;
  };

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .insert({
      name: input.name.trim(),
      brand_id: brandRow.id,
      client_id: brandRow.client_id,
      group_id: brandRow.group_id,
      status: "draft",
      currency_code: brandRow.currency_code,
      category_id: brandRow.category_id,
      subcategory_id: brandRow.subcategory_id,
      agency_or_direct: brandRow.client?.agency_or_direct ?? null,
      vr_rate_id: brandRow.vr_rate_id,
      shortlist_id: input.shortlistId,
      quotation_id: input.quotationId,
      created_by: userId,
    } as never)
    .select("id, document_number")
    .single();

  if (headerError || !header) {
    return { ok: false, message: headerError?.message ?? "Failed to create campaign." };
  }

  return {
    ok: true,
    id: (header as { id: string }).id,
    document_number: (header as { document_number: string }).document_number,
  };
}

export async function createCampaignFromQuotation(input: {
  quotationId: string;
  campaignName?: string | null;
}): Promise<ActionResult<{ campaignId: string; documentNumber: string; shortlistId: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const campaignAuth = await requirePermission(actor.supabase, "campaigns.write");
  if ("error" in campaignAuth) {
    return { ok: false, message: "You need campaign write access to create a campaign." };
  }

  const row = await loadQuotationRow(actor.supabase, input.quotationId);
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
    const moved = await moveQuotationToShortlist(input.quotationId);
    if (!moved.ok || !moved.data?.shortlistId) {
      return { ok: false, message: moved.message ?? "Failed to create linked shortlist." };
    }
    shortlistId = moved.data.shortlistId;
  }

  const campaignName =
    input.campaignName?.trim() ||
    `Campaign — ${row.name ?? row.serial_number ?? "Quotation"}`;

  const created = await createCampaignHeaderFromBrand(actor.supabase, actor.userId, {
    name: campaignName,
    brandId: row.brand_id as string,
    quotationId: input.quotationId,
    shortlistId,
  });

  if (!created.ok) return created;

  const { data: items } = await actor.supabase
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
        actor.supabase,
        item.profile_id,
        actor.userId
      );
      if (promotion.ok) influencerId = promotion.influencerId;
    }
    if (!influencerId) continue;

    const { data: existing } = await actor.supabase
      .from("campaign_influencers")
      .select("id")
      .eq("campaign_header_id", created.id)
      .eq("influencer_id", influencerId)
      .maybeSingle();

    if (existing?.id) continue;

    await actor.supabase.from("campaign_influencers").insert({
      campaign_id: created.id,
      campaign_header_id: created.id,
      influencer_id: influencerId,
      status: "invited",
      source_shortlist_id: shortlistId,
      source_shortlist_item_id: item.source_shortlist_item_id,
      shortlist_assignment_status: "suggested",
      created_by: actor.userId,
    } as never);

    assigned += 1;
  }

  await actor.supabase
    .from("quotations")
    .update({ campaign_header_id: created.id } as never)
    .eq("id", input.quotationId);

  await actor.supabase
    .from("discovery_shortlists")
    .update({ campaign_header_id: created.id } as never)
    .eq("id", shortlistId);

  await logQuotationLifecycleEvent(actor.supabase, {
    quotationId: input.quotationId,
    actorId: actor.userId,
    event: "quotation.campaign_created",
    summary: `Campaign ${created.document_number} created from approved quotation.`,
    metadata: {
      campaignId: created.id,
      documentNumber: created.document_number,
      shortlistId,
      assignments: assigned,
    },
  });

  revalidateQuotation(input.quotationId, shortlistId, created.id);

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
  quotationId: string
): Promise<
  ActionResult<{
    events: Array<{
      id: string;
      action: string;
      summary: string;
      created_at: string;
      actor_name: string | null;
    }>;
  }>
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.read);
  if ("error" in auth) {
    const admin = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in admin) return { ok: false, message: auth.error };
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, metadata, created_at, actor:actor_id(full_name)")
    .eq("entity_type", "quotation")
    .eq("entity_id", quotationId)
    .order("created_at", { ascending: false })
    .limit(100);

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

export async function getQuotationVersionChain(
  quotationId: string
): Promise<
  ActionResult<{
    versions: Array<{
      id: string;
      serial_number: string | null;
      version_number: number;
      status: string;
    }>;
    linkedShortlist: { id: string; serial_number: string | null } | null;
    linkedCampaign: { id: string; document_number: string } | null;
  }>
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;

  const { data: current } = await supabase
    .from("quotations")
    .select(
      "id, serial_number, version_number, status, parent_quotation_id, shortlist_id, campaign_header_id"
    )
    .eq("id", quotationId)
    .maybeSingle();

  if (!current) return { ok: false, message: "Quotation not found." };

  const cur = current as {
    id: string;
    serial_number: string | null;
    version_number: number;
    status: string;
    parent_quotation_id: string | null;
    shortlist_id: string | null;
    campaign_header_id: string | null;
  };

  const baseSerial = stripQuotationVersionSuffix(cur.serial_number);
  const { data: siblings } = await supabase
    .from("quotations")
    .select("id, serial_number, version_number, status")
    .ilike("serial_number", `${baseSerial}%`)
    .order("version_number", { ascending: true });

  let linkedShortlist: { id: string; serial_number: string | null } | null = null;
  if (cur.shortlist_id) {
    const { data: sl } = await supabase
      .from("discovery_shortlists")
      .select("id, serial_number")
      .eq("id", cur.shortlist_id)
      .maybeSingle();
    if (sl) linkedShortlist = sl as { id: string; serial_number: string | null };
  }

  let linkedCampaign: { id: string; document_number: string } | null = null;
  if (cur.campaign_header_id) {
    const { data: ch } = await supabase
      .from("campaign_headers")
      .select("id, document_number")
      .eq("id", cur.campaign_header_id)
      .maybeSingle();
    if (ch) linkedCampaign = ch as { id: string; document_number: string };
  }

  return {
    ok: true,
    data: {
      versions: ((siblings ?? []) as Array<{
        id: string;
        serial_number: string | null;
        version_number: number;
        status: string;
      }>) ?? [cur],
      linkedShortlist,
      linkedCampaign,
    },
  };
}
