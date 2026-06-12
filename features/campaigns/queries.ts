import { filterUuids, isUuid } from "@/lib/validation/uuid";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REL } from "@/lib/supabase/relation-hints";
import { resolveOperationalPo } from "@/lib/finance/po/operational-budget";
import type { PoStatus } from "@/lib/finance/po/status";
import {
  resolveVatRateForCountry,
  resolveVendorDefaultVatPercent,
} from "@/lib/vat/queries";
import {
  getBrandsForCampaignForm,
  getMasterDataOptions,
} from "@/lib/master-data/queries";
import {
  syncCampaignHeaderStatus,
  syncCampaignHeaderStatusesForList,
} from "@/lib/campaigns/sync-campaign-header-status";
import { getCampaignClientIo, getCampaignVendorIos, getClientIoSendRecipients } from "@/features/io/queries";
import { buildActiveVendorIoLinkMap } from "@/lib/io/vendor-io-active-link";
import { buildActiveVendorIoDocumentMap } from "@/lib/io/vendor-io-document-map";
import type { CampaignListItem } from "@/types/database";

import type { CampaignLineBillingStatus } from "@/features/billing/types";
import { CAMPAIGNS_PAGE_SIZE, METADATA_PLATFORM_KEY } from "./constants";
import {
  deriveLinePaymentStatus,
  deriveWorkflowStage,
  formatMarginPercent,
  mapDeliverableDisplayStatus,
  type BrandFormOption,
  type CampaignLineWorkspace,
  type CampaignWorkspace,
  type InfluencerAssignmentProfile,
  type InfluencerSearchResult,
} from "./types";
import {
  countLineDeliverables,
  parseLineAssignment,
  platformLabel,
  suggestCostFromRateCard,
  suggestCurrencyFromPaymentDetails,
} from "./line-assignment";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { rollupLineClientCommercial } from "@/lib/assignments/client-billing-commercial";

export type CampaignsListResult = {
  campaigns: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CampaignFormOptions = {
  brands: BrandFormOption[];
  accountManagers: {
    id: string;
    full_name: string | null;
    email: string;
  }[];
  masterData: Awaited<ReturnType<typeof getMasterDataOptions>>;
};

type HeaderWithRelations = {
  id: string;
  document_number: string;
  name: string;
  description: string | null;
  brief: string | null;
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
  assignment_status: import("@/features/campaigns/types").CampaignLineAssignmentStatus;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  finance_override_until?: string | null;
  invoice_id: string | null;
  operational_status?: string | null;
  vendor_io_id?: string | null;
};

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to continue.");
  }

  return { supabase, user };
}

export async function getCampaignsList(params: {
  page?: number;
  search?: string;
}): Promise<CampaignsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * CAMPAIGNS_PAGE_SIZE;
  const to = from + CAMPAIGNS_PAGE_SIZE - 1;

  const { supabase } = await requireUser();

  let query = supabase
    .from("campaign_headers")
    .select(
      `
      *,
      brand:brands(id, name),
      client:clients(id, name, document_number, legal_name),
      group:groups(id, name),
      account_manager:profiles!campaign_headers_account_manager_id_fkey(id, full_name, email),
      lines:campaign_lines(id, document_number, name, po_amount, revenue, cost, profit, billing_status, invoice_id)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const campaigns = (data ?? []) as unknown as CampaignListItem[];

  try {
    await syncCampaignHeaderStatusesForList(supabase, campaigns);
  } catch (syncError) {
    console.warn("[campaigns-list] syncCampaignHeaderStatusesForList failed", syncError);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CAMPAIGNS_PAGE_SIZE));

  return {
    campaigns,
    total,
    page,
    pageSize: CAMPAIGNS_PAGE_SIZE,
    totalPages,
  };
}

export type CampaignsKpis = {
  total_campaigns: number;
  total_revenue: number;
  avg_margin: number;
  assignments: number;
  currency_code: string;
};

export async function getCampaignsKpis(): Promise<CampaignsKpis> {
  const { supabase } = await requireUser();

  const [headersResult, linesResult, assignmentsResult] = await Promise.all([
    supabase.from("campaign_headers").select("id, currency_code").limit(2000),
    supabase.from("campaign_lines").select("revenue, profit").limit(5000),
    supabase
      .from("campaign_influencers")
      .select("id", { count: "exact", head: true }),
  ]);

  const headers = (headersResult.data ?? []) as {
    id: string;
    currency_code: string | null;
  }[];
  const lines = (linesResult.data ?? []) as {
    revenue: number | null;
    profit: number | null;
  }[];

  const totalRevenue = lines.reduce((sum, l) => sum + Number(l.revenue ?? 0), 0);
  const totalProfit = lines.reduce((sum, l) => sum + Number(l.profit ?? 0), 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const currencyCounts = new Map<string, number>();
  for (const header of headers) {
    const code = header.currency_code ?? DEFAULT_PLATFORM_CURRENCY;
    currencyCounts.set(code, (currencyCounts.get(code) ?? 0) + 1);
  }
  const currencyCode =
    [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      DEFAULT_PLATFORM_CURRENCY;

  return {
    total_campaigns: headers.length,
    total_revenue: totalRevenue,
    avg_margin: avgMargin,
    assignments: assignmentsResult.count ?? 0,
    currency_code: currencyCode,
  };
}

export async function getCampaignFormOptions(): Promise<CampaignFormOptions> {
  const { supabase } = await requireUser();

  const [brands, masterData, managersResult] = await Promise.all([
    getBrandsForCampaignForm(),
    getMasterDataOptions(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (managersResult.error) {
    throw new Error(managersResult.error.message);
  }

  return {
    brands: brands as unknown as BrandFormOption[],
    masterData,
    accountManagers: managersResult.data ?? [],
  };
}

export async function getCampaignWorkspace(
  campaignId: string
): Promise<CampaignWorkspace | null> {
  if (!isUuid(campaignId)) {
    return null;
  }

  const { supabase } = await requireUser();

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select(
      `
      *,
      brand:brands(id, name, document_number),
      client:clients(
        id, name, document_number, legal_name, country,
        group:groups(id, name, document_number)
      ),
      group:groups(id, name, document_number),
      team:md_teams(id, name),
      account_manager:profiles!campaign_headers_account_manager_id_fkey(id, full_name, email)
    `
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (headerError) {
    throw new Error(headerError.message);
  }
  if (!header) {
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
    approvalsResult,
    auditResult,
    clientIo,
    vendorIos,
  ] = await Promise.all([
    supabase
      .from("campaign_lines")
      .select("*")
      .eq("campaign_header_id", campaignId)
      .order("document_number"),
    supabase
      .from("campaign_influencers")
      .select(
        `
        id, campaign_line_id, campaign_header_id, influencer_id, status, agreed_fee, currency,
        deliverable_count, invited_at, confirmed_at, vendor_payment_status,
        influencer:influencers(id, document_number, display_name),
        line:${REL.campaignInfluencers.campaignLine}(document_number)
      `
      )
      .eq("campaign_header_id", campaignId),
    supabase
      .from("deliverables")
      .select(
        `
        id, document_number, deliverable_type, title, status, platform,
        due_date, submitted_at, approved_at, published_at, content_url, metrics,
        influencer:influencers(display_name)
      `
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("*")
      .or(`campaign_header_id.eq.${campaignId},campaign_id.eq.${campaignId}`)
      .order("issue_date", { ascending: false }),
    supabase
      .from("approvals")
      .select(
        `
        id, document_number, entity_type, title, status, due_at, decided_at,
        assignee:profiles!approvals_assigned_to_fkey(full_name, email)
      `
      )
      .or(
        `and(entity_type.eq.campaign,entity_id.eq.${campaignId}),entity_type.eq.deliverable,entity_type.eq.campaign_influencer`
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, created_at, actor_id, new_data")
      .or(
        [
          `and(entity_type.eq.campaign_headers,entity_id.eq.${campaignId})`,
          `entity_type.eq.campaign_lines`,
          `entity_type.eq.campaign_influencers`,
          `entity_type.eq.deliverables`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(50),
    getCampaignClientIo(campaignId),
    getCampaignVendorIos(campaignId),
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
    const { data: accounts } = await supabase
      .from("influencer_platform_accounts")
      .select(
        "influencer_id, platform, handle, profile_url, follower_count, engagement_rate"
      )
      .in("influencer_id", influencerIds);
    platformAccounts = accounts ?? [];
  }

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
    const { data: paymentRows } = await supabase
      .from("payments")
      .select("id, document_number, invoice_id, amount, currency, status, paid_at")
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false });

    payments = (paymentRows ?? []).map((p) => {
      const row = p as unknown as {
        id: string;
        document_number: string;
        invoice_id: string;
        amount: number;
        currency: string;
        status: string;
        paid_at: string | null;
      };
      return {
        id: row.id,
        document_number: row.document_number,
        invoice_document_number: invoiceDocMap.get(row.invoice_id) ?? "",
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        paid_at: row.paid_at,
      };
    });
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
    const poConsumed = Number(line.po_consumed ?? cost);
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
  const legacyConsumed = workspaceLines.reduce(
    (s, l) => s + l.revenue_before_vat,
    0
  );
  const revenue = campaignBillableBase;
  const cost = campaignCost;
  const gp = campaignGp;
  const billingOutstanding = invoices.reduce((s, i) => s + i.outstanding, 0);
  const collected = invoices.reduce((s, i) => s + i.amount_paid, 0);

  const deliverableIds = new Set(
    (deliverablesResult.data ?? []).map((d) => (d as { id: string }).id)
  );
  const vendorIds = new Set(vendors.map((v) => v.id));

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

  const filteredApprovals = (approvalsResult.data ?? []).filter((a) => {
    const row = a as unknown as { entity_type: string; entity_id: string };
    if (row.entity_type === "campaign" && row.entity_id === campaignId) {
      return true;
    }
    if (row.entity_type === "deliverable" && deliverableIds.has(row.entity_id)) {
      return true;
    }
    if (
      row.entity_type === "campaign_influencer" &&
      vendorIds.has(row.entity_id)
    ) {
      return true;
    }
    return false;
  });

  const filteredAudit = (auditResult.data ?? []).filter((log) => {
    const row = log as unknown as { entity_type: string; entity_id: string | null };
    if (row.entity_type === "campaign_headers" && row.entity_id === campaignId) {
      return true;
    }
    if (row.entity_type === "campaign_lines" && row.entity_id && lineIds.has(row.entity_id)) {
      return true;
    }
    if (
      row.entity_type === "campaign_influencers" &&
      row.entity_id &&
      vendorIds.has(row.entity_id)
    ) {
      return true;
    }
    if (
      row.entity_type === "deliverables" &&
      row.entity_id &&
      deliverableIds.has(row.entity_id)
    ) {
      return true;
    }
    return false;
  });

  const actorIds = [
    ...new Set(
      filteredAudit
        .map((log) => (log as { actor_id?: string | null }).actor_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let profileMap = new Map<string, { id: string; full_name: string | null; email: string }>();
  if (actorIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));
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
    po_consumed_amount: headerRow.po_consumed_amount,
    po_remaining_amount: headerRow.po_remaining_amount,
    po_remaining_percent: headerRow.po_remaining_percent,
    po_status: headerRow.po_status,
    po_expiry_date: headerRow.po_expiry_date,
    legacy_budget: legacyBudget,
    legacy_consumed: legacyConsumed,
  });

  const clientIoSendRecipients = clientIo
    ? await getClientIoSendRecipients(clientIo.client_id)
    : [];

  const workspace = {
    id: headerRow.id,
    document_number: headerRow.document_number,
    name: headerRow.name,
    description: headerRow.description,
    brief: headerRow.brief,
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
      po_exceeded: operationalPo.po_exceeded,
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
    vendor_ios: vendorIos ?? [],
    vat_context: {
      client_country_code: clientCountryCode,
      default_revenue_vat_percent: defaultRevenueVatPercent,
    },
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

export async function searchInfluencersForCampaign(params: {
  search?: string;
  platform?: string;
  limit?: number;
}): Promise<InfluencerSearchResult[]> {
  const { supabase } = await requireUser();
  const search = params.search?.trim() ?? "";
  const platform = params.platform?.trim() ?? "";
  const limit = params.limit ?? 20;

  let influencerIds: string[] | null = null;

  if (platform) {
    const { data: platformMatches, error } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id")
      .eq("platform", platform);

    if (error) {
      throw new Error(error.message);
    }

    influencerIds = [
      ...new Set(platformMatches?.map((r) => r.influencer_id) ?? []),
    ];
    if (influencerIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("influencers")
    .select("id, document_number, display_name, status, country_code, rate_card, payment_details")
    .eq("status", "active")
    .order("display_name")
    .limit(limit);

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`display_name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(
        ","
      )
    );
  }

  if (influencerIds) {
    query = query.in("id", influencerIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return [];
  }

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, audience_country"
    )
    .in("influencer_id", ids);

  const accountsByInfluencer = new Map<
    string,
    InfluencerSearchResult["platforms"]
  >();
  for (const account of accounts ?? []) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push({
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      engagement_rate: account.engagement_rate,
      audience_country: account.audience_country ?? null,
    });
    accountsByInfluencer.set(account.influencer_id, list);
  }

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      document_number: string;
      display_name: string;
      status: string;
      country_code: string | null;
      rate_card: Record<string, unknown>;
      payment_details: Record<string, unknown>;
    };
    return {
      id: r.id,
      document_number: r.document_number,
      display_name: r.display_name,
      status: r.status,
      country_code: r.country_code,
      suggested_currency: suggestCurrencyFromPaymentDetails(
        r.payment_details,
        DEFAULT_PLATFORM_CURRENCY
      ),
      platforms: accountsByInfluencer.get(r.id) ?? [],
    };
  });
}

export async function getInfluencerForAssignment(
  influencerId: string
): Promise<InfluencerAssignmentProfile | null> {
  const { supabase } = await requireUser();

  const { data: influencer, error } = await supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, status, country_code, rate_card, payment_details, vat_registered, default_vat_percent, tax_registration_number, notes"
    )
    .eq("id", influencerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!influencer) return null;

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, handle, profile_url, follower_count, engagement_rate, audience_country"
    )
    .eq("influencer_id", influencerId)
    .order("is_primary", { ascending: false });

  const platforms = (accounts ?? []).map((a) => ({
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    profile_url: a.profile_url,
    follower_count: a.follower_count,
    engagement_rate: a.engagement_rate,
    audience_country: a.audience_country ?? null,
  }));

  const inf = influencer as unknown as {
    id: string;
    document_number: string;
    display_name: string;
    status: string;
    country_code: string | null;
    rate_card: Record<string, unknown>;
    payment_details: Record<string, unknown>;
    vat_registered: boolean;
    default_vat_percent: number;
    tax_registration_number: string | null;
    notes: string | null;
  };

  const suggested_currency = suggestCurrencyFromPaymentDetails(
    inf.payment_details,
    DEFAULT_PLATFORM_CURRENCY
  );
  const countryVatRate = await resolveVatRateForCountry(supabase, inf.country_code);
  const suggested_cost_vat_percent = resolveVendorDefaultVatPercent({
    vatRegistered: inf.vat_registered,
    defaultVatPercent: Number(inf.default_vat_percent ?? 0),
    countryCode: inf.country_code,
    countryVatRate,
  });

  return {
    id: inf.id,
    document_number: inf.document_number,
    display_name: inf.display_name,
    status: inf.status,
    country_code: inf.country_code,
    suggested_currency,
    platforms,
    rate_card: inf.rate_card,
    payment_details: inf.payment_details,
    suggested_cost: suggestCostFromRateCard(inf.rate_card, []),
    vat_registered: inf.vat_registered,
    default_vat_percent: Number(inf.default_vat_percent ?? 0),
    tax_registration_number: inf.tax_registration_number,
    notes: inf.notes,
    suggested_cost_vat_percent,
  };
}

export async function browseInfluencersForCampaign(
  params: import("./types").CreatorBrowseFilters
): Promise<import("./types").CreatorBrowseResult> {
  const { supabase } = await requireUser();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, params.pageSize ?? 20);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = params.search?.trim() ?? "";
  const platform = params.platform?.trim() ?? "";
  const country = params.country?.trim().toUpperCase() ?? "";
  const category = params.category?.trim() ?? "";

  let influencerIds: string[] | null = null;

  if (platform || params.minFollowers != null || params.maxFollowers != null || params.minEngagement != null) {
    let accountQuery = supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, follower_count, engagement_rate, handle, profile_url, platform");

    if (platform) {
      accountQuery = accountQuery.eq("platform", platform);
    }
    if (params.minFollowers != null) {
      accountQuery = accountQuery.gte("follower_count", params.minFollowers);
    }
    if (params.maxFollowers != null) {
      accountQuery = accountQuery.lte("follower_count", params.maxFollowers);
    }
    if (params.minEngagement != null) {
      accountQuery = accountQuery.gte("engagement_rate", params.minEngagement);
    }

    const { data: platformMatches, error: platformError } = await accountQuery;
    if (platformError) throw new Error(platformError.message);

    let ids = [...new Set(platformMatches?.map((r) => r.influencer_id) ?? [])];

    if (search) {
      const pattern = `%${escapeIlikePattern(search)}%`;
      const handleMatches = (platformMatches ?? []).filter(
        (a) =>
          a.handle?.toLowerCase().includes(search.toLowerCase()) ||
          a.profile_url?.toLowerCase().includes(search.toLowerCase())
      );
      const handleIds = new Set(handleMatches.map((a) => a.influencer_id));

      const { data: nameMatches } = await supabase
        .from("influencers")
        .select("id")
        .eq("status", "active")
        .or(
          [`display_name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
        );

      const nameIds = new Set(nameMatches?.map((r) => r.id) ?? []);
      ids = ids.filter((id) => handleIds.has(id) || nameIds.has(id));
      for (const id of nameIds) {
        if (!ids.includes(id)) ids.push(id);
      }
    }

    influencerIds = ids;
    if (influencerIds.length === 0) {
      return { creators: [], total: 0, page, pageSize };
    }
  }

  let query = supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, status, country_code, categories, notes, rate_card, payment_details",
      { count: "exact" }
    )
    .eq("status", "active")
    .order("display_name");

  if (country) {
    query = query.eq("country_code", country);
  }

  if (category) {
    query = query.contains("categories", [category]);
  }

  if (search && !platform && params.minFollowers == null && params.maxFollowers == null) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`display_name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  if (influencerIds) {
    query = query.in("id", influencerIds);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return { creators: [], total: count ?? 0, page, pageSize };
  }

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, audience_country, is_verified, is_primary"
    )
    .in("influencer_id", ids)
    .order("is_primary", { ascending: false });

  const accountsByInfluencer = new Map<string, InfluencerSearchResult["platforms"]>();
  for (const account of accounts ?? []) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push({
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      engagement_rate: account.engagement_rate,
      audience_country: account.audience_country ?? null,
      is_verified: account.is_verified ?? false,
    });
    accountsByInfluencer.set(account.influencer_id, list);
  }

  const creators: InfluencerSearchResult[] = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      document_number: string;
      display_name: string;
      status: string;
      country_code: string | null;
      categories: string[];
      notes: string | null;
      rate_card: Record<string, unknown>;
      payment_details: Record<string, unknown>;
    };
    return {
      id: r.id,
      document_number: r.document_number,
      display_name: r.display_name,
      status: r.status,
      country_code: r.country_code,
      categories: r.categories ?? [],
      notes: r.notes,
      suggested_currency: suggestCurrencyFromPaymentDetails(
        r.payment_details,
        DEFAULT_PLATFORM_CURRENCY
      ),
      platforms: accountsByInfluencer.get(r.id) ?? [],
    };
  });

  return {
    creators,
    total: count ?? creators.length,
    page,
    pageSize,
  };
}

export { getBrandHierarchySnapshot } from "@/lib/master-data/queries";
