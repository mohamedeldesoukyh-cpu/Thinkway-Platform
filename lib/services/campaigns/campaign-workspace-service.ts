import type { SupabaseClient } from "@supabase/supabase-js";

import { filterUuids, isUuid } from "@/lib/validation/uuid";
import { traceCampaignRoute, traceCampaignRouteError } from "@/lib/performance/campaign-route-trace";
import {
  resolveOperationalPo,
  resolveWorkspacePoAlert,
} from "@/lib/finance/po/operational-budget";
import type { PoStatus } from "@/lib/finance/po/status";
import { resolveVatRateForCountry } from "@/lib/vat/queries";
import {
  getCampaignClientIo,
  getCampaignVendorIos,
  getClientIoSendHistory,
  getClientIoSendRecipients,
} from "@/lib/io/campaign-io-queries";
import { buildActiveVendorIoLinkMap } from "@/lib/io/vendor-io-active-link";
import { buildActiveVendorIoDocumentMap } from "@/lib/io/vendor-io-document-map";
import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import type { CampaignLineBillingStatus } from "@/lib/domains/billing/types";
import { METADATA_PLATFORM_KEY } from "@/lib/campaigns/constants";
import {
  deriveLinePaymentStatus,
  deriveWorkflowStage,
  formatMarginPercent,
  mapDeliverableDisplayStatus,
  type CampaignLineWorkspace,
  type CampaignWorkspace,
} from "@/lib/domains/campaign/workspace-types";
import {
  countLineDeliverables,
  parseLineAssignment,
  platformLabel,
} from "@/lib/campaigns/line-assignment";
import { rollupLineClientCommercial } from "@/lib/assignments/client-billing-commercial";
import {
  fetchCampaignApprovals,
  fetchCampaignAuditLogs,
  fetchCampaignDeliverables,
  fetchCampaignHeaderWithRelations,
  fetchCampaignInfluencers,
  fetchCampaignInvoices,
  fetchCampaignLines,
  fetchInfluencerPlatformAccounts,
  fetchPaymentsForInvoiceIds,
  fetchProfileNamesByIds,
} from "./repositories/workspace-repository";
import {
  fetchInfluencerAvatarMetaMap,
  resolveInfluencerAvatarFieldsFromMeta,
} from "@/lib/creators/influencer-avatar-meta";
import { getCampaignIntelligenceForHeader } from "@/lib/domains/intelligence/campaign-intelligence-object";
import { formatCampaignRequirements } from "@/features/campaign-intelligence-profile/services/format-campaign-requirements";
import { normalizeCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/services/normalize-profile";

type HeaderWithRelations = {
  id: string;
  document_number: string;
  name: string;
  description: string | null;
  brief: string | null;
  campaign_intelligence_profile_id?: string | null;
  status: CampaignWorkspace["status"];
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  metadata: Record<string, unknown>;
  brand: { id: string; name: string; document_number: string } | null;
  client: {
    id: string;
    name: string;
    document_number: string;
    legal_name: string | null;
  } | null;
  group: { id: string; name: string; document_number: string } | null;
  team: { id: string; name: string } | null;
  account_manager: CampaignWorkspace["account_manager"];
};

type LineRow = {
  id: string;
  document_number: string;
  name: string;
  status: CampaignWorkspace["status"];
  platform: string | null;
  metadata: Record<string, unknown>;
  revenue: number;
  cost: number;
  revenue_before_vat?: number;
  usage_rights_amount?: number;
  usage_rights_cost?: number;
  agency_fee_percent?: number;
  agency_fee_amount?: number;
  revenue_vat_percent?: number;
  revenue_vat_amount?: number;
  revenue_after_vat?: number;
  revenue_vat_exempt?: boolean;
  cost_received?: number | null;
  cost_received_currency?: string | null;
  fx_from_currency?: string | null;
  cost_before_vat?: number;
  cost_vat_percent?: number;
  cost_vat_amount?: number;
  cost_after_vat?: number;
  cost_vat_exempt?: boolean;
  vat_locked?: boolean;
  profit: number;
  profit_margin: number;
  po_amount: number;
  po_consumed: number;
  remaining_po: number;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  billing_status: CampaignLineBillingStatus;
  assignment_status: import("@/lib/domains/campaign/workspace-types").CampaignLineAssignmentStatus;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  finance_override_until?: string | null;
  invoice_id: string | null;
  operational_status?: string | null;
  vendor_io_id?: string | null;
};

export async function getCampaignWorkspace(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string
): Promise<CampaignWorkspace | null> {
  if (!isUuid(campaignId)) {
    return null;
  }

  traceCampaignRoute("workspace:load:start", { campaignId });

  const user = { id: userId };

  const { data: header, error: headerError } = await fetchCampaignHeaderWithRelations(supabase, campaignId);

  if (headerError) {
    traceCampaignRouteError("workspace:header-query", headerError, { campaignId });
    throw new Error(headerError.message);
  }
  if (!header) {
    traceCampaignRoute("workspace:header-not-found", { campaignId });
    return null;
  }

  try {
    const statusSync = await syncCampaignHeaderStatus(supabase, campaignId);
    if (statusSync.updated) {
      (header as { status: string }).status = statusSync.status;
    }
  } catch (error) {
    console.warn("[campaign-workspace] syncCampaignHeaderStatus failed", error);
  }

  const [
    linesResult,
    vendorsResult,
    deliverablesResult,
    invoicesResult,
    clientIo,
    vendorIos,
  ] = await Promise.all([
    fetchCampaignLines(supabase, campaignId),
    fetchCampaignInfluencers(supabase, campaignId),
    fetchCampaignDeliverables(supabase, campaignId),
    fetchCampaignInvoices(supabase, campaignId),
    getCampaignClientIo(campaignId),
    getCampaignVendorIos(campaignId),
  ]);

  const scopedLineIds = (linesResult.data ?? []).map((line) => (line as { id: string }).id);
  const scopedVendorIds = (vendorsResult.data ?? []).map(
    (vendor) => (vendor as { id: string }).id
  );
  const scopedDeliverableIds = (deliverablesResult.data ?? []).map(
    (deliverable) => (deliverable as { id: string }).id
  );

  const [approvalsResult, auditResult] = await Promise.all([
    fetchCampaignApprovals(supabase, campaignId, {
      vendorIds: scopedVendorIds,
      deliverableIds: scopedDeliverableIds,
    }),
    fetchCampaignAuditLogs(supabase, campaignId, {
      lineIds: scopedLineIds,
      vendorIds: scopedVendorIds,
      deliverableIds: scopedDeliverableIds,
    }),
  ]);

  if (linesResult.error) {
    throw new Error(linesResult.error.message);
  }
  if (vendorsResult.error) {
    throw new Error(vendorsResult.error.message);
  }

  const lines = (linesResult.data ?? []) as unknown as LineRow[];
  const lineIds = new Set(lines.map((l) => l.id));
  const lineDocMap = new Map(lines.map((l) => [l.id, l.document_number]));
  const vendorIoDocById = new Map(
    (vendorIos ?? []).map((vio) => {
      const row = vio as unknown as { id: string; document_number?: string | null };
      return [row.id, row.document_number ?? ""] as const;
    })
  );

  const lineVendorIoIds = lines
    .map((l) => l.vendor_io_id)
    .filter((id): id is string => Boolean(id));
  const [activeVendorIoDocMap, activeVendorIoLinkMap] = await Promise.all([
    buildActiveVendorIoDocumentMap(supabase, lineVendorIoIds),
    buildActiveVendorIoLinkMap(supabase, lineVendorIoIds),
  ]);

  const vendorInfluencerIds = (vendorsResult.data ?? []).map(
    (v) => (v as { influencer_id: string }).influencer_id
  );
  const assignmentInfluencerIds = lines
    .map((line) => parseLineAssignment(line.metadata as Record<string, unknown>)?.influencer_id)
    .filter((id): id is string => Boolean(id));

  const influencerIds = filterUuids([...vendorInfluencerIds, ...assignmentInfluencerIds]);

  let platformAccounts: {
    influencer_id: string;
    platform: string;
    handle: string;
    profile_url: string | null;
    follower_count: number | null;
    engagement_rate: number | null;
  }[] = [];

  if (influencerIds.length > 0) {
    platformAccounts = await fetchInfluencerPlatformAccounts(supabase, influencerIds);
  }

  const influencerAvatarMeta =
    influencerIds.length > 0
      ? await fetchInfluencerAvatarMetaMap(supabase, influencerIds)
      : new Map();

  const accountsByInfluencer = new Map<string, typeof platformAccounts>();
  for (const account of platformAccounts) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push(account);
    accountsByInfluencer.set(account.influencer_id, list);
  }

  const vendors = (vendorsResult.data ?? []).map((row) => {
    const v = row as unknown as {
      id: string;
      campaign_line_id: string | null;
      influencer_id: string;
      status: string;
      agreed_fee: number;
      currency: string;
      deliverable_count: number;
      invited_at: string | null;
      confirmed_at: string | null;
      influencer: {
        id: string;
        document_number: string;
        display_name: string;
      } | null;
      line: { document_number: string } | null;
    };
    return {
      id: v.id,
      campaign_line_id: v.campaign_line_id,
      line_document_number:
        v.line?.document_number ??
        (v.campaign_line_id ? lineDocMap.get(v.campaign_line_id) ?? null : null),
      influencer_id: v.influencer_id,
      influencer_name: v.influencer?.display_name ?? "Unknown",
      influencer_document_number: v.influencer?.document_number ?? "",
      status: v.status,
      agreed_fee: Number(v.agreed_fee),
      currency: v.currency,
      deliverable_count: v.deliverable_count,
      vendor_payment_status: (v as { vendor_payment_status?: string | null })
        .vendor_payment_status ?? null,
      platforms: accountsByInfluencer.get(v.influencer_id) ?? [],
      invited_at: v.invited_at,
      confirmed_at: v.confirmed_at,
    };
  });

  const influencersByLine = new Map<string, number>();
  const vendorFeesByLine = new Map<string, number>();
  const vendorByLine = new Map<
    string,
    { id: string; vendor_payment_status: string | null }
  >();
  for (const vendor of vendors) {
    if (vendor.campaign_line_id) {
      influencersByLine.set(
        vendor.campaign_line_id,
        (influencersByLine.get(vendor.campaign_line_id) ?? 0) + 1
      );
      vendorFeesByLine.set(
        vendor.campaign_line_id,
        (vendorFeesByLine.get(vendor.campaign_line_id) ?? 0) + vendor.agreed_fee
      );
      if (!vendorByLine.has(vendor.campaign_line_id)) {
        vendorByLine.set(vendor.campaign_line_id, {
          id: vendor.id,
          vendor_payment_status: vendor.vendor_payment_status ?? null,
        });
      }
    }
  }

  const invoices = (invoicesResult.data ?? []).map((inv) => {
    const row = inv as unknown as {
      id: string;
      document_number: string;
      status: string;
      regeneration_status?: string | null;
      issue_date: string;
      due_date: string | null;
      total: number;
      amount_paid: number;
      currency: string;
    };
    const total = Number(row.total);
    const amountPaid = Number(row.amount_paid);
    return {
      id: row.id,
      document_number: row.document_number,
      status: row.status,
      regeneration_status: row.regeneration_status ?? null,
      issue_date: row.issue_date,
      due_date: row.due_date,
      total,
      amount_paid: amountPaid,
      outstanding: Math.max(0, total - amountPaid),
      currency: row.currency,
    };
  });

  let payments: CampaignWorkspace["payments"] = [];
  if (invoices.length > 0) {
    const invoiceIds = invoices.map((i) => i.id);
    const invoiceDocMap = new Map(invoices.map((i) => [i.id, i.document_number]));
    payments = await fetchPaymentsForInvoiceIds(supabase, invoiceIds, invoiceDocMap);
  }

  let campaignBillableBase = 0;
  let campaignCost = 0;
  let campaignGp = 0;

  const workspaceLines = lines.map((line) => {
    const revenue = Number(line.revenue);
    const cost = Number(line.cost);
    const revenueBeforeVat = Number(line.revenue_before_vat ?? revenue);
    const usageRightsAmount = Number(line.usage_rights_amount ?? 0);
    const usageRightsCost = Number(line.usage_rights_cost ?? 0);
    const agencyFeePercent = Number(line.agency_fee_percent ?? 0);
    const agencyFeeAmount = Number(line.agency_fee_amount ?? 0);
    const costBeforeVat = Number(line.cost_before_vat ?? cost);
    const commercial = rollupLineClientCommercial({
      revenueBeforeVat,
      usageRightsAmount,
      usageRightsCost,
      agencyFeePercent,
      agencyFeeAmount,
      costBeforeVat,
    });
    const gp = commercial.gp;
    campaignBillableBase += commercial.billableBase;
    campaignCost += costBeforeVat;
    campaignGp += gp;
    const poAmount = Number(line.po_amount);
    const poConsumed = commercial.billableBase;
    const vendorFees = vendorFeesByLine.get(line.id) ?? 0;
    const assignment = parseLineAssignment(line.metadata);
    const platformSummary = assignment
      ? assignment.platforms
          .map((p) => platformLabel(p.platform))
          .join(", ")
      : null;

    const vendorLink = vendorByLine.get(line.id);
    const influencerId = assignment?.influencer_id ?? null;
    const creatorPlatformAccounts = influencerId
      ? (accountsByInfluencer.get(influencerId) ?? [])
      : [];
    const primaryPlatform =
      assignment?.platforms[0]?.platform ?? line.platform ?? null;
    const avatarFields =
      influencerId != null
        ? resolveInfluencerAvatarFieldsFromMeta(
            influencerAvatarMeta,
            influencerId,
            primaryPlatform
          )
        : {
            creator_profile_image_url: null,
            influencer_avatar_url: null,
            creator_avatar_url: null,
          };

    return {
      id: line.id,
      document_number: line.document_number,
      name: line.name,
      status: line.status,
      assignment_status:
        (line.assignment_status as CampaignLineWorkspace["assignment_status"]) ??
        "draft",
      platform: line.platform,
      influencer_id: assignment?.influencer_id ?? null,
      influencer_name: assignment?.influencer_name ?? null,
      creator_profile_image_url: avatarFields.creator_profile_image_url,
      influencer_avatar_url: avatarFields.influencer_avatar_url,
      creator_avatar_url: avatarFields.creator_avatar_url,
      platform_summary: platformSummary,
      deliverable_count: assignment
        ? countLineDeliverables(assignment.platforms)
        : 0,
      influencer_count: influencersByLine.get(line.id) ?? 0,
      campaign_influencer_id: vendorLink?.id ?? null,
      vendor_payment_status:
        (vendorLink?.vendor_payment_status as CampaignLineWorkspace["vendor_payment_status"]) ??
        null,
      revenue,
      cost,
      revenue_before_vat: revenueBeforeVat,
      usage_rights_amount: usageRightsAmount,
      usage_rights_cost: usageRightsCost,
      agency_fee_percent: agencyFeePercent,
      agency_fee_amount: agencyFeeAmount,
      revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
      revenue_vat_amount: Number(line.revenue_vat_amount ?? 0),
      revenue_after_vat: Number(line.revenue_after_vat ?? revenue),
      revenue_vat_exempt: line.revenue_vat_exempt ?? false,
      cost_received: Number(line.cost_received ?? line.cost_before_vat ?? cost),
      cost_received_currency:
        line.cost_received_currency ??
        line.fx_from_currency ??
        line.currency_code,
      cost_before_vat: costBeforeVat,
      cost_vat_percent: Number(line.cost_vat_percent ?? 0),
      cost_vat_amount: Number(line.cost_vat_amount ?? 0),
      cost_after_vat: Number(line.cost_after_vat ?? cost),
      cost_vat_exempt: line.cost_vat_exempt ?? false,
      vat_locked: line.vat_locked ?? false,
      gp,
      margin_percent: commercial.marginPercent,
      po_amount: poAmount,
      po_consumed: poConsumed,
      remaining_po: Number(line.remaining_po),
      po_over_consumed: poConsumed > poAmount && poAmount > 0,
      billing_status: line.billing_status ?? "draft",
      operational_status:
        (line.operational_status as CampaignLineWorkspace["operational_status"]) ?? "draft",
      vendor_io_id: line.vendor_io_id ?? null,
      active_vendor_io_id: line.vendor_io_id
        ? (activeVendorIoLinkMap.get(line.vendor_io_id) ?? null)
        : null,
      vendor_io_document_number: line.vendor_io_id
        ? (activeVendorIoDocMap.get(line.vendor_io_id) ??
          vendorIoDocById.get(line.vendor_io_id) ??
          null)
        : null,
      revenue_locked: line.revenue_locked ?? false,
      cost_locked: line.cost_locked ?? false,
      vendor_assignment_locked: line.vendor_assignment_locked ?? false,
      finance_override_until: line.finance_override_until ?? null,
      invoice_id: line.invoice_id ?? null,
      payment_status: deriveLinePaymentStatus(cost, vendorFees),
      currency_code: line.currency_code,
      start_date: line.start_date,
      end_date: line.end_date,
      assignment,
      creator_platform_accounts: creatorPlatformAccounts,
    };
  });

  const legacyBudget = workspaceLines.reduce((s, l) => s + l.po_amount, 0);
  const revenue = campaignBillableBase;
  const cost = campaignCost;
  const gp = campaignGp;
  const billingOutstanding = invoices.reduce((s, i) => s + i.outstanding, 0);
  const collected = invoices.reduce((s, i) => s + i.amount_paid, 0);

  const deliverables = (deliverablesResult.data ?? []).map((row) => {
    const d = row as unknown as {
      id: string;
      document_number: string;
      deliverable_type: string;
      title: string;
      status: string;
      platform: string | null;
      due_date: string | null;
      submitted_at: string | null;
      approved_at: string | null;
      published_at: string | null;
      content_url: string | null;
      metrics: Record<string, unknown>;
      influencer: { display_name: string } | null;
    };
    return {
      id: d.id,
      document_number: d.document_number,
      deliverable_type: d.deliverable_type,
      title: d.title,
      status: d.status,
      display_status: mapDeliverableDisplayStatus(d.status),
      influencer_name: d.influencer?.display_name ?? "Unknown",
      platform: d.platform,
      due_date: d.due_date,
      submitted_at: d.submitted_at,
      approved_at: d.approved_at,
      published_at: d.published_at,
      content_url: d.content_url,
      metrics: d.metrics ?? {},
    };
  });

  const filteredApprovals = approvalsResult.data ?? [];

  const filteredAudit = auditResult.data ?? [];

  const actorIds = [
    ...new Set(
      filteredAudit
        .map((log) => (log as { actor_id?: string | null }).actor_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let profileMap = new Map<string, { id: string; full_name: string | null; email: string }>();
  if (actorIds.length > 0) {
    profileMap = await fetchProfileNamesByIds(supabase, actorIds);
  }

  const approvals = filteredApprovals.map((row) => {
    const a = row as unknown as {
      id: string;
      document_number: string;
      entity_type: string;
      title: string;
      status: string;
      due_at: string | null;
      decided_at: string | null;
      assignee: { full_name: string | null; email: string } | null;
    };
    return {
      id: a.id,
      document_number: a.document_number,
      entity_type: a.entity_type,
      title: a.title,
      status: a.status,
      assigned_to_name: a.assignee?.full_name ?? a.assignee?.email ?? null,
      due_at: a.due_at,
      decided_at: a.decided_at,
    };
  });

  const blockers: string[] = [];
  if (approvals.some((a) => a.status === "pending" || a.status === "in_review")) {
    blockers.push("Pending approvals require action");
  }
  if (deliverables.some((d) => d.display_status === "rejected")) {
    blockers.push("Rejected deliverables need revision");
  }
  if (billingOutstanding > 0) {
    blockers.push("Outstanding client billing");
  }
  if (workspaceLines.some((l) => l.assignment_status === "awaiting_content")) {
    blockers.push("Creator content pending submission");
  }
  if (workspaceLines.some((l) => l.vendor_payment_status === "unpaid" && l.cost > 0)) {
    blockers.push("Creator payouts outstanding");
  }

  const headerRow = header as unknown as HeaderWithRelations & {
    client: { country: string | null } | null;
    po_number?: string | null;
    po_currency?: string | null;
    po_exchange_rate?: number | null;
    po_amount_original?: number;
    po_amount_campaign_currency?: number;
    po_consumed_amount?: number;
    po_remaining_amount?: number;
    po_remaining_percent?: number | null;
    po_status?: PoStatus;
    po_expiry_date?: string | null;
    po_override_approved?: boolean;
    po_override_reason?: string | null;
    fx_snapshot_at?: string | null;
  };
  const clientCountryCode = headerRow.client?.country?.trim().toUpperCase().slice(0, 2) ?? null;
  const defaultRevenueVatPercent = await resolveVatRateForCountry(
    supabase,
    clientCountryCode
  );
  const platform =
    typeof headerRow.metadata?.[METADATA_PLATFORM_KEY] === "string"
      ? headerRow.metadata[METADATA_PLATFORM_KEY]
      : null;

  const workspaceVendors = vendors;
  const workflowStage = deriveWorkflowStage({
    status: headerRow.status,
    lines: workspaceLines,
    invoices,
  });

  const operationalPo = resolveOperationalPo({
    po_amount_campaign_currency: headerRow.po_amount_campaign_currency,
    po_consumed_amount: campaignBillableBase,
    po_remaining_amount: null,
    po_remaining_percent: null,
    po_status: headerRow.po_status,
    po_expiry_date: headerRow.po_expiry_date,
    legacy_budget: legacyBudget,
    legacy_consumed: campaignBillableBase,
  });

  const poAlert = resolveWorkspacePoAlert({
    operational: operationalPo,
  });

  const clientIoSendRecipients = clientIo
    ? await getClientIoSendRecipients(clientIo.client_id)
    : [];
  const clientIoSendHistory = clientIo ? await getClientIoSendHistory(clientIo.id) : [];

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const clientIoSenderName =
    (currentProfile as { full_name?: string | null } | null)?.full_name?.trim() ?? null;

  const linkedIntelligence = await getCampaignIntelligenceForHeader(supabase, headerRow.id);
  const intelligenceProfile = linkedIntelligence
    ? normalizeCampaignIntelligenceProfile(linkedIntelligence.profile)
    : null;
  const campaignIntelligence = linkedIntelligence
    ? {
        profileId: linkedIntelligence.id,
        title:
          linkedIntelligence.title ??
          intelligenceProfile?.campaignName ??
          intelligenceProfile?.brandName ??
          "Campaign intelligence",
        status: linkedIntelligence.status,
        requirementsSummary: intelligenceProfile
          ? formatCampaignRequirements(intelligenceProfile).slice(0, 1200)
          : null,
        searchUrl: `/discovery/search?profileId=${encodeURIComponent(linkedIntelligence.id)}`,
        libraryUrl: `/discovery/intelligence/library`,
      }
    : null;

  const workspace = {
    id: headerRow.id,
    document_number: headerRow.document_number,
    name: headerRow.name,
    description: headerRow.description,
    brief: campaignIntelligence?.requirementsSummary ?? headerRow.brief,
    status: headerRow.status,
    currency_code: headerRow.currency_code,
    start_date: headerRow.start_date,
    end_date: headerRow.end_date,
    platform,
    group:
      headerRow.group ??
      (
        headerRow.client as {
          group?: { id: string; name: string; document_number: string } | null;
        } | null
      )?.group ??
      null,
    client: headerRow.client,
    brand: headerRow.brand,
    team: headerRow.team,
    account_manager: headerRow.account_manager,
    po: {
      po_number: headerRow.po_number ?? null,
      po_currency: headerRow.po_currency ?? headerRow.currency_code,
      po_exchange_rate:
        headerRow.po_exchange_rate != null
          ? Number(headerRow.po_exchange_rate)
          : null,
      po_amount_original: Number(
        headerRow.po_amount_original ??
          (operationalPo.uses_governance ? operationalPo.po_amount : legacyBudget)
      ),
      po_amount_campaign_currency: operationalPo.po_amount,
      po_consumed_amount: operationalPo.po_consumed,
      po_remaining_amount: operationalPo.po_remaining,
      po_remaining_percent: operationalPo.po_remaining_percent,
      po_status: operationalPo.po_status,
      po_expiry_date: headerRow.po_expiry_date ?? null,
      po_override_approved: headerRow.po_override_approved ?? false,
      po_override_reason: headerRow.po_override_reason ?? null,
      fx_snapshot_at: headerRow.fx_snapshot_at ?? null,
      health: operationalPo.health,
    },
    financials: {
      budget: operationalPo.po_amount,
      revenue,
      cost,
      gp,
      margin_percent: formatMarginPercent(revenue, gp),
      po_total: operationalPo.po_amount,
      remaining_po: operationalPo.po_remaining,
      po_consumed: operationalPo.po_consumed,
      po_remaining_percent: operationalPo.po_remaining_percent,
      po_status: operationalPo.po_status,
      po_health: operationalPo.health,
      po_exceeded: poAlert.po_exceeded,
      po_banner_consumed: poAlert.po_banner_consumed,
      billing_outstanding: billingOutstanding,
      collected,
    },
    workflow_stage: workflowStage,
    lines: workspaceLines,
    vendors: workspaceVendors,
    deliverables,
    invoices,
    payments,
    approvals,
    activity: filteredAudit.slice(0, 30).map((log) => {
      const row = log as unknown as {
        id: string;
        action: string;
        entity_type: string;
        created_at: string;
        actor_id: string | null;
      };
      const actor = row.actor_id ? profileMap.get(row.actor_id) : null;
      return {
        id: row.id,
        action: row.action,
        entity_type: row.entity_type,
        created_at: row.created_at,
        actor: actor
          ? {
              id: actor.id,
              full_name: actor.full_name,
              email: actor.email,
            }
          : null,
        summary: `${row.action} · ${row.entity_type}`,
      };
    }),
    blockers,
    client_io: clientIo,
    client_io_send_recipients: clientIoSendRecipients,
    client_io_send_history: clientIoSendHistory,
    client_io_sender_name: clientIoSenderName,
    campaign_intelligence: campaignIntelligence,
    vendor_ios: vendorIos ?? [],
    vat_context: {
      client_country_code: clientCountryCode,
      default_revenue_vat_percent: defaultRevenueVatPercent,
    },
    campaign_object_id:
      (headerRow as { campaign_object_id?: string | null }).campaign_object_id ?? null,
    quotation_id: (headerRow as { quotation_id?: string | null }).quotation_id ?? null,
  };

  if (process.env.NODE_ENV === "development") {
    const arrayFields = {
      lines: workspace.lines,
      vendors: workspace.vendors,
      deliverables: workspace.deliverables,
      invoices: workspace.invoices,
      payments: workspace.payments,
      approvals: workspace.approvals,
      activity: workspace.activity,
      blockers: workspace.blockers,
      vendor_ios: workspace.vendor_ios,
    };
    for (const [field, value] of Object.entries(arrayFields)) {
      if (!Array.isArray(value)) {
        console.error("[campaign-workspace-trace] getCampaignWorkspace:non-array-field", {
          campaignId,
          field,
          valueType: typeof value,
          keys: value != null && typeof value === "object" ? Object.keys(value as object) : [],
          json: JSON.stringify(value).slice(0, 1000),
        });
        throw new Error(
          `[campaign-workspace-trace] getCampaignWorkspace: ${field} is not an array`
        );
      }
    }
    console.log("[campaign-workspace-trace] getCampaignWorkspace:ok", {
      campaignId,
      lines: workspace.lines.length,
      vendor_ios: workspace.vendor_ios.length,
      deliverables: workspace.deliverables.length,
    });
  }

  return workspace;
}

