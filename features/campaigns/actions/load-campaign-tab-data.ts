"use server";

import { getCampaignFormOptions } from "@/features/campaigns/queries";
import {
  getCampaignPerformanceBundle,
  type CampaignPerformanceCharts,
  type CampaignPerformanceSummary,
} from "@/features/campaigns/queries/publications";
import { EMPTY_CAMPAIGN_FORM_OPTIONS } from "@/features/campaigns/campaign-page-fallbacks";
import {
  getCampaignBillingGroups,
  getCampaignBillingLines,
  getCampaignOperationalBillingDetail,
} from "@/features/billing/queries";
import type {
  AssignmentBillingGroup,
  BillingLineRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import { getFinanceInvoiceRegister } from "@/features/finance/invoices/queries";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { devLog } from "@/lib/dev-log";
import { loadFinanceAuditTimeline } from "@/lib/finance/queries/finance-audit";
import type { FinanceAuditTimelineEntry } from "@/lib/finance/queries/finance-audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export type CampaignDeferredBundle =
  | "formOptions"
  | "assignmentsBilling"
  | "billing"
  | "publications"
  | "financeAudit";

export type CampaignFormOptionsPayload = {
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  currencyOptions: { value: string; label: string }[];
};

export type CampaignAssignmentsBillingPayload = {
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
};

export type CampaignBillingPayload = {
  billingLines: BillingLineRow[];
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  campaignInvoiceRegister: FinanceInvoiceRegisterRow[];
};

export type CampaignPublicationsPayload = {
  publications: Awaited<ReturnType<typeof getCampaignPerformanceBundle>>["publications"];
  summary: CampaignPerformanceSummary;
  charts: CampaignPerformanceCharts;
  loadError: string | null;
};

export type CampaignFinanceAuditPayload = {
  financeAudit: FinanceAuditTimelineEntry[];
};

type BundleResult<T> = { ok: true; data: T } | { ok: false; error: string };

function invalidCampaignResult<T>(): BundleResult<T> {
  return { ok: false, error: "Invalid campaign ID." };
}

export async function loadCampaignFormOptionsBundle(
  campaignId: string
): Promise<BundleResult<CampaignFormOptionsPayload>> {
  if (!isUuid(campaignId)) return invalidCampaignResult();

  try {
    const formOptions = await getCampaignFormOptions();
    return {
      ok: true,
      data: {
        accountManagers: formOptions.accountManagers,
        teams: formOptions.masterData.teams,
        currencyOptions: buildCurrencyOptions(formOptions.masterData.currencies),
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      devLog("[campaign-tab-data] form options fallback", error);
    }
    const fallback = EMPTY_CAMPAIGN_FORM_OPTIONS;
    return {
      ok: true,
      data: {
        accountManagers: fallback.accountManagers,
        teams: fallback.masterData.teams,
        currencyOptions: buildCurrencyOptions(fallback.masterData.currencies),
      },
    };
  }
}

export async function loadCampaignAssignmentsBillingBundle(
  campaignId: string
): Promise<BundleResult<CampaignAssignmentsBillingPayload>> {
  if (!isUuid(campaignId)) return invalidCampaignResult();

  try {
    const settled = await Promise.allSettled([
      getCampaignBillingGroups(campaignId),
      getCampaignOperationalBillingDetail(campaignId),
    ]);

    const billingGroups =
      settled[0].status === "fulfilled" ? settled[0].value : [];

    let operationalBilling: CampaignOperationalBillingDetail | null = null;
    if (settled[1].status === "fulfilled") {
      operationalBilling = settled[1].value;
    } else {
      const { logCampaignWorkspaceLoadError } = await import(
        "@/lib/billing/operational-billing-trace"
      );
      logCampaignWorkspaceLoadError(
        "getCampaignOperationalBillingDetail",
        settled[1].reason,
        { campaignId }
      );
    }

    return {
      ok: true,
      data: { billingGroups, operationalBilling },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to load assignments billing data.",
    };
  }
}

export async function loadCampaignBillingBundle(
  campaignId: string
): Promise<BundleResult<CampaignBillingPayload>> {
  if (!isUuid(campaignId)) return invalidCampaignResult();

  try {
    const settled = await Promise.allSettled([
      getCampaignBillingLines(campaignId),
      getCampaignBillingGroups(campaignId),
      getCampaignOperationalBillingDetail(campaignId),
      getFinanceInvoiceRegister({ campaignHeaderId: campaignId }),
    ]);

    const billingLines =
      settled[0].status === "fulfilled" ? settled[0].value : [];
    const billingGroups =
      settled[1].status === "fulfilled" ? settled[1].value : [];

    let operationalBilling: CampaignOperationalBillingDetail | null = null;
    if (settled[2].status === "fulfilled") {
      operationalBilling = settled[2].value;
    } else {
      const { logCampaignWorkspaceLoadError } = await import(
        "@/lib/billing/operational-billing-trace"
      );
      logCampaignWorkspaceLoadError(
        "getCampaignOperationalBillingDetail",
        settled[2].reason,
        { campaignId }
      );
    }

    const campaignInvoiceRegister =
      settled[3].status === "fulfilled" ? settled[3].value : [];

    if (settled[0].status === "rejected" && process.env.NODE_ENV === "development") {
      devLog("[campaign-tab-data] billing lines fallback", settled[0].reason);
    }
    if (settled[3].status === "rejected" && process.env.NODE_ENV === "development") {
      devLog("[campaign-tab-data] invoice register fallback", settled[3].reason);
    }

    return {
      ok: true,
      data: { billingLines, billingGroups, operationalBilling, campaignInvoiceRegister },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load billing data.",
    };
  }
}

export async function loadCampaignPublicationsBundle(
  campaignId: string
): Promise<BundleResult<CampaignPublicationsPayload>> {
  if (!isUuid(campaignId)) return invalidCampaignResult();

  try {
    const result = await getCampaignPerformanceBundle(campaignId);
    return {
      ok: true,
      data: {
        publications: result.publications,
        summary: result.summary,
        charts: result.charts,
        loadError: result.load_error,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load publications.";
    console.error("[campaign-tab-data] publications failed", { campaignId, message });
    return {
      ok: true,
      data: {
        publications: [],
        summary: {
          total_publications: 0,
          total_reach: 0,
          total_impressions: 0,
          total_views: 0,
          total_engagements: 0,
          average_engagement_rate: null,
          average_cpm: null,
          average_cpv: null,
          top_creator_name: null,
          top_creator_engagements: 0,
          currency: "USD",
        },
        charts: {
          performance_over_time: [],
          platform_split: [],
          content_type_split: [],
          top_creators_by_engagement: [],
          reach_by_creator: [],
          views_by_publication: [],
          engagement_distribution: [],
        },
        loadError: message,
      },
    };
  }
}

export async function loadCampaignFinanceAuditBundle(
  campaignId: string
): Promise<BundleResult<CampaignFinanceAuditPayload>> {
  if (!isUuid(campaignId)) return invalidCampaignResult();

  try {
    const supabase = await createSupabaseServerClient();
    const financeAudit = await loadFinanceAuditTimeline(supabase, {
      campaign_id: campaignId,
      limit: 40,
    });
    return { ok: true, data: { financeAudit } };
  } catch (error) {
    devLog("[campaign-tab-data] finance audit failed", { campaignId, error });
    return {
      ok: true,
      data: { financeAudit: [] },
    };
  }
}
