import { requireRequestUser } from "@/lib/supabase/server";
import { getBillingDashboard as loadBillingDashboard } from "@/lib/services/billing/statement-service";
import { getInvoiceWorkspace as loadInvoiceWorkspace } from "@/lib/services/billing/invoice-service";
import {
  getCampaignBillingGroups as loadCampaignBillingGroups,
  getCampaignBillingLines as loadCampaignBillingLines,
  getCampaignOperationalBillingDetail as loadCampaignOperationalBillingDetail,
} from "@/lib/services/billing/billing-service";

export type {
  AgingBucket,
  AssignmentBillingGroup,
  BillingDashboard,
  BillingInvoiceRow,
  BillingKpiSummary,
  BillingLineRow,
  CampaignLineBillingStatus,
  CampaignOperationalBillingDetail,
  FinancialApprovalRow,
  InvoiceWorkspace,
  VendorAssignmentPaymentRow,
  VendorPaymentBatchRow,
} from "./types";

export async function getBillingDashboard() {
  const { supabase } = await requireRequestUser();
  return loadBillingDashboard(supabase);
}

export async function getInvoiceWorkspace(invoiceId: string) {
  const { supabase } = await requireRequestUser();
  return loadInvoiceWorkspace(supabase, invoiceId);
}

export async function getCampaignBillingLines(campaignId: string) {
  const { supabase } = await requireRequestUser();
  return loadCampaignBillingLines(supabase, campaignId);
}

export async function getCampaignBillingGroups(campaignId: string) {
  const { supabase } = await requireRequestUser();
  return loadCampaignBillingGroups(supabase, campaignId);
}

export async function getCampaignOperationalBillingDetail(
  campaignId: string,
  options?: { syncCommercial?: boolean }
) {
  const { supabase } = await requireRequestUser();
  return loadCampaignOperationalBillingDetail(supabase, campaignId, options);
}
