/**
 * Release 2.0 Phase 1 — Unified Quote → Assignment convert.
 * Quotation = commercial SSOT; campaign_lines = operational SSOT.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isQuotationExpired } from "@/lib/commercial/quotation-validity";
import { logQuotationLifecycleEvent } from "@/lib/commercial-sync/audit";
import { canCreateCampaignFromQuotation } from "@/lib/commercial-sync/rules";
import { ensureCommercialCreatorFromQuoteToCampaign } from "@/lib/creators/crm/activation-helpers";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  mapQuotationItemsToExecutionLineSeeds,
  type QuotationItemExecutionRow,
} from "@/lib/domains/commercial/quotation-execution-mapper";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { fetchInfluencerPlatformAccounts } from "@/lib/services/campaigns/repositories/assignment-repository";
import {
  buildQuotationConvertUnits,
  summarizeQuotationConvertSelection,
  type QuotationConvertUnit,
} from "@/lib/domains/commercial/quotation-convert-selection";
import {
  buildQuotationConvertSnapshotHash,
  CONVERT_COPIED_FIELDS,
  CONVERT_REMAINS_ON_QUOTATION,
  countDeliverables,
} from "@/lib/domains/commercial/quotation-convert-snapshot";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { isRelease20AssignmentConvertEnabled } from "@/lib/release/release-2-0-feature-flag";
import type { Database } from "@/types/database";
import { normalizeCreatorId } from "@/features/campaign-studio/services/studio-draft";

import { applyInheritedTentativeScheduleToLine } from "./apply-inherited-tentative-schedule";
import { createCampaignLine } from "./campaign-line-service";
import { maybeActivateCommercialCreatorForAssignment } from "@/lib/campaigns/campaign-influencer-commercial";

import {
  copyQuotationItemsToShortlist,
  createCampaignHeaderFromBrand,
  createLinkedShortlist,
  linkQuotationToCampaign,
  linkQuotationToShortlist,
  linkShortlistToCampaign,
  loadQuotationRow,
} from "@/lib/services/quotations/repositories/quotation-repository";

export type ConvertQuotationToAssignmentsInput = {
  quotationId: string;
  campaignName?: string | null;
  /** Reuse an existing header (backfill). */
  reuseHeaderId?: string | null;
  /** When true, only compute plan — no writes. */
  dryRun?: boolean;
};

export type ConvertAssignmentPreviewRow = {
  kind: "item" | "package";
  name: string;
  revenue: number;
  cost: number;
  afPct: number;
  memberCount: number;
  deliverableCount: number;
  primaryItemId: string;
};

export type ConvertQuotationPreview = {
  snapshotHash: string;
  headerStatus: "planning";
  copied: readonly string[];
  remainsOnQuotation: readonly string[];
  assignments: ConvertAssignmentPreviewRow[];
  packageCount: number;
  itemCount: number;
  quotationSerial: string | null;
  versionNumber: number;
};

export type ConvertQuotationToAssignmentsResult =
  | {
      ok: true;
      alreadyExists?: boolean;
      dryRun?: boolean;
      campaignId: string;
      documentNumber: string;
      shortlistId: string | null;
      linesCreated: number;
      lineIds: string[];
      skippedItems: number;
      skippedAlternatives: number;
      warnings: string[];
      message: string;
      preview?: ConvertQuotationPreview;
      snapshotHash?: string;
    }
  | { ok: false; message: string };

function buildPreview(input: {
  row: Record<string, unknown>;
  units: QuotationConvertUnit[];
  selection: ReturnType<typeof summarizeQuotationConvertSelection>;
  quotationId: string;
}): ConvertQuotationPreview {
  const versionNumber = Number(input.row.version_number ?? 1);
  const snapshotHash = buildQuotationConvertSnapshotHash({
    quotationId: input.quotationId,
    serialNumber: (input.row.serial_number as string | null) ?? null,
    versionNumber,
    currency: (input.row.currency as string | null) ?? null,
    totalRevenueEgp: Number(input.row.total_revenue_egp ?? 0),
    totalCostEgp: Number(input.row.total_cost_egp ?? 0),
    units: input.units,
  });

  return {
    snapshotHash,
    headerStatus: "planning",
    copied: CONVERT_COPIED_FIELDS,
    remainsOnQuotation: CONVERT_REMAINS_ON_QUOTATION,
    packageCount: input.selection.packageCount,
    itemCount: input.selection.itemCount,
    quotationSerial: (input.row.serial_number as string | null) ?? null,
    versionNumber,
    assignments: input.units.map((unit) => ({
      kind: unit.kind,
      name:
        unit.kind === "package"
          ? unit.primaryItem.collapse_label?.trim() ||
            unit.primaryItem.creator_name ||
            "Package"
          : unit.primaryItem.creator_name || "Creator",
      revenue: unit.primaryItem.revenue,
      cost: unit.primaryItem.cost,
      afPct: unit.primaryItem.af_pct,
      memberCount: unit.memberItems.length,
      deliverableCount: countDeliverables(unit.memberItems),
      primaryItemId: unit.primaryItem.id,
    })),
  };
}

function parseDeliverables(raw: unknown): QuotationDeliverable[] {
  if (!Array.isArray(raw)) return [];
  return raw as QuotationDeliverable[];
}

function toItemRow(raw: Record<string, unknown>): QuotationItemRow {
  return {
    id: String(raw.id),
    influencer_id: (raw.influencer_id as string | null) ?? null,
    profile_id: (raw.profile_id as string | null) ?? null,
    unified_id: (raw.unified_id as string | null) ?? null,
    source_shortlist_item_id: (raw.source_shortlist_item_id as string | null) ?? null,
    creator_name: (raw.creator_name as string | null) ?? null,
    platform: (raw.platform as string | null) ?? null,
    handle: (raw.handle as string | null) ?? null,
    followers: (raw.followers as number | null) ?? null,
    engagement_rate: (raw.engagement_rate as number | null) ?? null,
    country_code: (raw.country_code as string | null) ?? null,
    deliverables: parseDeliverables(raw.deliverables),
    profile_image_url: (raw.profile_image_url as string | null) ?? null,
    profile_url: (raw.profile_url as string | null) ?? null,
    option_number: (raw.option_number as number | null) ?? null,
    service_description: (raw.service_description as string | null) ?? null,
    commercial_input_mode:
      (raw.commercial_input_mode as QuotationItemRow["commercial_input_mode"]) ??
      "cost_revenue",
    cost: Number(raw.cost ?? 0),
    cost_currency: String(raw.cost_currency ?? "EGP"),
    revenue: Number(raw.revenue ?? 0),
    gp_pct: Number(raw.gp_pct ?? 0),
    gp_value: Number(raw.gp_value ?? 0),
    fx_rate_to_egp: Number(raw.fx_rate_to_egp ?? 1),
    cost_egp: Number(raw.cost_egp ?? 0),
    revenue_egp: Number(raw.revenue_egp ?? 0),
    gp_value_egp: Number(raw.gp_value_egp ?? 0),
    af_pct: Number(raw.af_pct ?? 0),
    af_value: Number(raw.af_value ?? 0),
    af_value_egp: Number(raw.af_value_egp ?? 0),
    sort_order: Number(raw.sort_order ?? 0),
    collapse_group_id: (raw.collapse_group_id as string | null) ?? null,
    collapse_label: (raw.collapse_label as string | null) ?? null,
  };
}

function mergeUnitDeliverables(unit: QuotationConvertUnit): QuotationDeliverable[] {
  const out: QuotationDeliverable[] = [];
  for (const member of unit.memberItems) {
    out.push(...(member.deliverables ?? []));
  }
  if (out.length === 0 && unit.primaryItem.platform) {
    out.push({
      platform: unit.primaryItem.platform,
      type: "other",
      quantity: 1,
    });
  }
  return out;
}

function unitToExecutionRow(
  unit: QuotationConvertUnit,
  influencerId: string
): QuotationItemExecutionRow {
  const primary = unit.primaryItem;
  return {
    id: primary.id,
    influencer_id: influencerId,
    unified_id: primary.unified_id,
    creator_name:
      unit.kind === "package"
        ? primary.collapse_label?.trim() ||
          primary.creator_name ||
          "Package"
        : primary.creator_name,
    platform: primary.platform,
    handle: primary.handle,
    deliverables: mergeUnitDeliverables(unit),
    cost: primary.cost,
    revenue: primary.revenue,
    cost_currency: primary.cost_currency,
    option_number: primary.option_number,
  };
}

function influencerIdFromUnifiedId(unifiedId: string | null | undefined): string | null {
  if (!unifiedId) return null;
  const trimmed = unifiedId.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("inf:")) {
    const id = trimmed.slice(4).trim();
    return id || null;
  }
  // Some rows store a bare influencer uuid in unified_id.
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  ) {
    return trimmed;
  }
  return null;
}

async function resolveInfluencerForItem(
  supabase: SupabaseClient<Database>,
  userId: string,
  item: QuotationItemRow
): Promise<string | null> {
  if (item.influencer_id) return item.influencer_id;

  const fromUnified = influencerIdFromUnifiedId(item.unified_id);
  if (fromUnified) {
    const { data } = await supabase
      .from("influencers")
      .select("id")
      .eq("id", fromUnified)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  if (item.profile_id) {
    const promotion = await promoteDiscoveredProfileToInfluencer(
      supabase,
      item.profile_id,
      userId
    );
    if (promotion.ok) return promotion.influencerId;
  }

  const handle = item.handle?.replace(/^@/, "").trim() || null;
  const creatorName = item.creator_name?.trim() || null;
  for (const candidate of [handle, creatorName]) {
    if (!candidate) continue;
    const { data } = await supabase
      .from("influencers")
      .select("id")
      .ilike("display_name", candidate)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

async function ensureShortlist(
  supabase: SupabaseClient<Database>,
  userId: string,
  quotationId: string,
  row: Record<string, unknown>
): Promise<{ ok: true; shortlistId: string } | { ok: false; message: string }> {
  let shortlistId = (row.shortlist_id as string | null) ?? null;
  if (shortlistId) return { ok: true, shortlistId };

  const created = await createLinkedShortlist(supabase, {
    name: `Shortlist — ${String(row.name ?? row.serial_number ?? "Quotation")}`,
    ownerId: userId,
    clientId: (row.client_id as string | null) ?? null,
    brandId: (row.brand_id as string | null) ?? null,
    quotationId,
    description: typeof row.notes === "string" ? row.notes.slice(0, 500) : null,
  });

  if (created.error || !created.data) {
    return {
      ok: false,
      message: created.error?.message ?? "Failed to create linked shortlist.",
    };
  }

  shortlistId = (created.data as { id: string }).id;
  await linkQuotationToShortlist(supabase, quotationId, shortlistId);
  await copyQuotationItemsToShortlist(supabase, quotationId, shortlistId, userId);
  return { ok: true, shortlistId };
}

function buildSnapshotPayload(input: {
  row: Record<string, unknown>;
  units: QuotationConvertUnit[];
  selection: ReturnType<typeof summarizeQuotationConvertSelection>;
  snapshotHash: string;
}) {
  return {
    serial_number: input.row.serial_number ?? null,
    version_number: input.row.version_number ?? 1,
    currency: input.row.currency ?? null,
    total_cost_egp: input.row.total_cost_egp ?? null,
    total_revenue_egp: input.row.total_revenue_egp ?? null,
    total_gp_value_egp: input.row.total_gp_value_egp ?? null,
    total_gp_pct: input.row.total_gp_pct ?? null,
    total_af_egp: input.row.total_af_egp ?? null,
    terms: input.row.terms ?? null,
    notes: input.row.notes ?? null,
    snapshot_hash: input.snapshotHash,
    selection: input.selection,
    units: input.units.map((unit) => ({
      kind: unit.kind,
      primaryItemId: unit.primaryItem.id,
      memberItemIds: unit.memberItems.map((m) => m.id),
      collapseGroupId: unit.kind === "package" ? unit.collapseGroupId : null,
      revenue: unit.primaryItem.revenue,
      cost: unit.primaryItem.cost,
      af_pct: unit.primaryItem.af_pct,
    })),
  };
}

/**
 * Convert an approved quotation into Campaign Assignments (campaign_lines).
 * Behind RELEASE_2_0_ASSIGNMENT_CONVERT feature flag at the action layer.
 */
export async function convertQuotationToAssignments(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ConvertQuotationToAssignmentsInput
): Promise<ConvertQuotationToAssignmentsResult> {
  const row = await loadQuotationRow(supabase, input.quotationId);
  if (!row) return { ok: false, message: "Quotation not found." };

  const status = row.status as Database["public"]["Tables"]["quotations"]["Row"]["status"];
  if (!canCreateCampaignFromQuotation(status)) {
    return { ok: false, message: "Only approved quotations can create Assignments." };
  }

  if (isQuotationExpired((row.validity_date as string | null) ?? null)) {
    return { ok: false, message: "This quotation has expired and cannot be converted." };
  }

  if (row.is_temporary_client || row.is_temporary_brand || !row.brand_id) {
    return {
      ok: false,
      message: "Promote temporary client/brand to master data before converting.",
    };
  }

  const warnings: string[] = [];
  const { data: itemRows, error: itemsError } = await supabase
    .from("quotation_items")
    .select(
      "id, influencer_id, profile_id, unified_id, source_shortlist_item_id, creator_name, platform, handle, followers, engagement_rate, country_code, deliverables, profile_image_url, profile_url, option_number, service_description, commercial_input_mode, cost, cost_currency, revenue, gp_pct, gp_value, fx_rate_to_egp, cost_egp, revenue_egp, gp_value_egp, af_pct, af_value, af_value_egp, sort_order, collapse_group_id, collapse_label"
    )
    .eq("quotation_id", input.quotationId)
    .order("sort_order", { ascending: true });

  if (itemsError) return { ok: false, message: itemsError.message };

  const items = ((itemRows ?? []) as Record<string, unknown>[]).map(toItemRow);
  const selection = summarizeQuotationConvertSelection(items);
  let units = buildQuotationConvertUnits(items);

  if (units.length === 0) {
    return {
      ok: false,
      message: "No selected quotation lines available to convert into Assignments.",
    };
  }

  const preview = buildPreview({
    row,
    units,
    selection,
    quotationId: input.quotationId,
  });

  // Idempotency: existing Assignments for this quote pin / header.
  const existingHeaderId =
    input.reuseHeaderId?.trim() ||
    (row.campaign_header_id as string | null) ||
    null;

  // Partial convert resume: skip units that already have a line for this quote item.
  let existingSourceItemIds = new Set<string>();
  if (existingHeaderId) {
    const { data: existingLines } = await supabase
      .from("campaign_lines")
      .select("id, source_quotation_item_id")
      .eq("campaign_header_id", existingHeaderId);

    existingSourceItemIds = new Set(
      (existingLines ?? [])
        .map((line) => (line as { source_quotation_item_id?: string | null }).source_quotation_item_id)
        .filter((id): id is string => Boolean(id))
    );

    const pendingUnits = units.filter(
      (unit) => !existingSourceItemIds.has(unit.primaryItem.id)
    );

    if ((existingLines?.length ?? 0) > 0 && pendingUnits.length === 0) {
      const { data: header } = await supabase
        .from("campaign_headers")
        .select("id, document_number")
        .eq("id", existingHeaderId)
        .maybeSingle();

      return {
        ok: true,
        alreadyExists: true,
        campaignId: existingHeaderId,
        documentNumber:
          (header as { document_number?: string } | null)?.document_number ?? "",
        shortlistId: (row.shortlist_id as string | null) ?? null,
        linesCreated: 0,
        lineIds: [],
        skippedItems: 0,
        skippedAlternatives: selection.skippedAlternativeCount,
        warnings: ["Campaign already has Assignments — convert is idempotent."],
        message: "Assignments already exist for this campaign.",
        preview,
        snapshotHash: preview.snapshotHash,
      };
    }

    // Resume incomplete convert: only create missing units.
    if (pendingUnits.length > 0 && pendingUnits.length < units.length) {
      warnings.push(
        `Resuming convert: ${existingSourceItemIds.size} Assignment(s) already present; creating ${pendingUnits.length} missing.`
      );
      units = pendingUnits;
    }
  }

  if (input.dryRun) {
    return {
      ok: true,
      dryRun: true,
      campaignId: existingHeaderId ?? "",
      documentNumber: "",
      shortlistId: (row.shortlist_id as string | null) ?? null,
      linesCreated: units.length,
      lineIds: [],
      skippedItems: 0,
      skippedAlternatives: selection.skippedAlternativeCount,
      warnings: [
        ...warnings,
        `${selection.packageCount} package Assignment(s)`,
        `${selection.itemCount} item Assignment(s)`,
        `${selection.skippedAlternativeCount} alternative option(s) skipped`,
      ],
      message: `Dry run: would create ${units.length} Assignment(s).`,
      preview,
      snapshotHash: preview.snapshotHash,
    };
  }

  const shortlistResult = await ensureShortlist(
    supabase,
    userId,
    input.quotationId,
    row
  );
  if (!shortlistResult.ok) return shortlistResult;

  const campaignName =
    input.campaignName?.trim() ||
    `Campaign — ${String(row.name ?? row.serial_number ?? "Quotation")}`;

  let campaignId = existingHeaderId;
  let documentNumber = "";

  if (!campaignId) {
    const created = await createCampaignHeaderFromBrand(supabase, userId, {
      name: campaignName,
      brandId: row.brand_id as string,
      quotationId: input.quotationId,
      shortlistId: shortlistResult.shortlistId,
      status: "planning",
      acceptedQuotationId: input.quotationId,
      acceptedQuotationVersion: Number(row.version_number ?? 1),
    });
    if (!created.ok) return created;
    campaignId = created.id;
    documentNumber = created.document_number;
  } else {
    const { data: header, error: headerError } = await supabase
      .from("campaign_headers")
      .update({
        status: "planning",
        quotation_id: input.quotationId,
        accepted_quotation_id: input.quotationId,
        accepted_quotation_version: Number(row.version_number ?? 1),
        shortlist_id: shortlistResult.shortlistId,
      } as never)
      .eq("id", campaignId)
      .select("id, document_number")
      .single();

    if (headerError || !header) {
      return {
        ok: false,
        message: headerError?.message ?? "Failed to update campaign header.",
      };
    }
    documentNumber = (header as { document_number: string }).document_number;
  }

  // Do not duplicate commercial snapshot when resuming a partial convert.
  if (existingSourceItemIds.size === 0) {
    const snapshotPayload = buildSnapshotPayload({
      row,
      units,
      selection,
      snapshotHash: preview.snapshotHash,
    });
    const { error: snapshotError } = await supabase
      .from("campaign_commercial_snapshots")
      .insert({
        campaign_header_id: campaignId,
        quotation_id: input.quotationId,
        quotation_serial: (row.serial_number as string | null) ?? null,
        version_number: Number(row.version_number ?? 1),
        payload: snapshotPayload,
        created_by: userId,
      });

    if (snapshotError) {
      warnings.push(`Commercial snapshot warning: ${snapshotError.message}`);
    }
  }

  const lineIds: string[] = [];
  let skippedItems = 0;

  // Resolve influencers for all units first, then hydrate creator platforms.
  const resolvedPrimaryByUnit = new Map<string, string>();
  for (const unit of units) {
    const primaryInfluencerId = await resolveInfluencerForItem(
      supabase,
      userId,
      unit.primaryItem
    );
    if (primaryInfluencerId) {
      resolvedPrimaryByUnit.set(unit.primaryItem.id, primaryInfluencerId);
    }
  }

  const influencerIds = [...new Set(resolvedPrimaryByUnit.values())];
  // Prefer direct platform-account hydration over Discovery browse (productionOnly
  // browse can omit vendors that still have influencer_platform_accounts).
  const creators: UnifiedCreatorResult[] = [];
  for (const influencerId of influencerIds) {
    const { data: influencer } = await supabase
      .from("influencers")
      .select("id, display_name, status, country_code")
      .eq("id", influencerId)
      .maybeSingle();
    const { data: accounts } = await fetchInfluencerPlatformAccounts(
      supabase,
      influencerId
    );
    creators.push({
      unified_id: `inf:${influencerId}`,
      source_type: "internal",
      influencer_id: influencerId,
      discovered_profile_id: null,
      document_number: null,
      display_name: (influencer?.display_name as string | null) ?? "Vendor",
      status: (influencer?.status as string | null) ?? null,
      country_code: (influencer?.country_code as string | null) ?? null,
      estimated_country: null,
      city: null,
      categories: [],
      language_codes: [],
      profile_image_url: null,
      bio: null,
      metrics: {
        followers: { value: null, confidence: "estimated" },
        engagement_rate: { value: null, confidence: "estimated" },
        avg_likes: { value: null, confidence: "estimated" },
        avg_comments: { value: null, confidence: "estimated" },
        avg_views: { value: null, confidence: "estimated" },
        posting_frequency_per_week: { value: null, confidence: "estimated" },
      },
      ai_category: null,
      ai_niche: null,
      authenticity_score: null,
      thinkway_score: 0,
      source_confidence: 0,
      brand_fit_score: null,
      is_platform_verified: false,
      platforms: (accounts ?? []).map((account) => ({
        id: account.id as string,
        platform: String(account.platform ?? "instagram"),
        handle: String(account.handle ?? ""),
        profile_url: (account.profile_url as string | null) ?? null,
        follower_count: (account.follower_count as number | null) ?? null,
        engagement_rate: (account.engagement_rate as number | null) ?? null,
        audience_country: (account.audience_country as string | null) ?? null,
      })),
    });
  }

  const influencerIdByCreatorId = new Map<string, string>();
  for (const creator of creators) {
    if (creator.influencer_id) {
      influencerIdByCreatorId.set(
        normalizeCreatorId(creator.unified_id),
        creator.influencer_id
      );
    }
  }

  for (const unit of units) {
    const primaryInfluencerId = resolvedPrimaryByUnit.get(unit.primaryItem.id);
    if (!primaryInfluencerId) {
      skippedItems += 1;
      warnings.push(
        `Skipped ${unit.primaryItem.creator_name ?? unit.primaryItem.id}: no influencer.`
      );
      continue;
    }

    const executionRow = unitToExecutionRow(unit, primaryInfluencerId);
    const seeds = mapQuotationItemsToExecutionLineSeeds({
      items: [executionRow],
      creators,
      influencerIdByCreatorId,
      defaultCurrency: String(row.currency ?? "EGP"),
    });

    const seed = seeds[0];
    if (!seed) {
      skippedItems += 1;
      warnings.push(
        `Skipped ${unit.primaryItem.creator_name ?? unit.primaryItem.id}: could not map platforms.`
      );
      continue;
    }

    const result = await createCampaignLine(supabase, userId, {
      campaign_id: campaignId,
      influencer_id: seed.influencerId,
      assignment_json: JSON.stringify({ platforms: seed.platforms }),
      pricing_mode: "package",
      name: seed.displayName,
      po_amount: seed.revenue,
      revenue: seed.revenue,
      cost: seed.cost,
      revenue_before_vat: seed.revenue,
      cost_before_vat: seed.cost,
      usage_rights_amount: 0,
      usage_rights_cost: 0,
      agency_fee_percent: Number(unit.primaryItem.af_pct ?? 0),
      revenue_vat_percent: 0,
      cost_vat_percent: 0,
      currency_code: seed.currencyCode,
      start_date: null,
      end_date: null,
      assignment_status: "assigned",
      source_quotation_id: input.quotationId,
      source_quotation_item_id: unit.primaryItem.id,
    });

    if (!result.ok) {
      skippedItems += 1;
      warnings.push(result.message);
      continue;
    }

    lineIds.push(result.lineId);

    // Package members: additional vendor links on the same Assignment (D3).
    // Direct insert — do not reuse syncCampaignInfluencerForLine (it assumes one influencer per line).
    if (unit.kind === "package") {
      for (const member of unit.memberItems) {
        if (member.id === unit.primaryItem.id) continue;
        const memberInfluencerId = await resolveInfluencerForItem(
          supabase,
          userId,
          member
        );
        if (!memberInfluencerId || memberInfluencerId === seed.influencerId) continue;

        const { data: existingMember } = await supabase
          .from("campaign_influencers")
          .select("id")
          .eq("campaign_line_id", result.lineId)
          .eq("influencer_id", memberInfluencerId)
          .maybeSingle();

        if (existingMember?.id) continue;

        const { data: insertedMember, error: memberError } = await supabase
          .from("campaign_influencers")
          .insert({
            campaign_id: campaignId,
            campaign_header_id: campaignId,
            campaign_line_id: result.lineId,
            influencer_id: memberInfluencerId,
            status: "invited",
            currency: seed.currencyCode,
            deliverable_count: 0,
            cost_before_vat: 0,
            cost_vat_percent: 0,
            cost_vat_amount: 0,
            cost_after_vat: 0,
            created_by: userId,
          } as never)
          .select("id")
          .single();

        if (memberError) {
          warnings.push(
            `Package member link warning (${member.creator_name ?? member.id}): ${memberError.message}`
          );
          continue;
        }

        if (insertedMember?.id) {
          await maybeActivateCommercialCreatorForAssignment(supabase, {
            influencerId: memberInfluencerId,
            campaignInfluencerId: insertedMember.id as string,
            actorId: userId,
            metadata: {
              path: "convertQuotationToAssignments.packageMember",
              campaignId,
              lineId: result.lineId,
            },
          });
        }
      }
    }

    if (seed.scheduleHints.length > 0) {
      await applyInheritedTentativeScheduleToLine(supabase, {
        campaignLineId: result.lineId,
        scheduleHints: seed.scheduleHints,
        fallbackLiveDate: null,
      });
    }

    try {
      const { data: ci } = await supabase
        .from("campaign_influencers")
        .select("id")
        .eq("campaign_line_id", result.lineId)
        .eq("influencer_id", seed.influencerId)
        .maybeSingle();

      if (ci?.id) {
        await ensureCommercialCreatorFromQuoteToCampaign(supabase, {
          influencerId: seed.influencerId,
          quotationId: input.quotationId,
          campaignInfluencerId: ci.id as string,
          actorId: userId,
          bypassRoleCheck: true,
          metadata: {
            path: "convertQuotationToAssignments",
            campaignId,
          },
        });
      }
    } catch (error) {
      warnings.push(
        `CRM activation warning: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  if (lineIds.length === 0) {
    return {
      ok: false,
      message:
        warnings[0] ??
        "No Assignments were created. Quotation items need a resolvable influencer (influencer_id, inf: unified_id, or profile_id).",
    };
  }

  await linkQuotationToCampaign(supabase, input.quotationId, campaignId);
  await linkShortlistToCampaign(supabase, shortlistResult.shortlistId, campaignId);

  await logQuotationLifecycleEvent(supabase, {
    quotationId: input.quotationId,
    actorId: userId,
    event: "quotation.converted_to_assignments",
    summary: `Campaign ${documentNumber} converted with ${lineIds.length} Assignment(s).`,
    metadata: {
      campaignId,
      documentNumber,
      linesCreated: lineIds.length,
      skippedItems,
      skippedAlternatives: selection.skippedAlternativeCount,
      flagEnabled: isRelease20AssignmentConvertEnabled(),
    },
  });

  return {
    ok: true,
    campaignId,
    documentNumber,
    shortlistId: shortlistResult.shortlistId,
    linesCreated: lineIds.length,
    lineIds,
    skippedItems,
    skippedAlternatives: selection.skippedAlternativeCount,
    warnings,
    message: `Campaign ${documentNumber}: created ${lineIds.length} Assignment(s).`,
    preview,
    snapshotHash: preview.snapshotHash,
  };
}
