import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  VendorPaymentBatchRow,
} from "./types";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Unauthorized");
  return { supabase, user };
}

export async function getBillingDashboard() {
  const { supabase } = await requireUser();
  return loadBillingDashboard(supabase);
}

export async function getInvoiceWorkspace(invoiceId: string) {
  const { supabase } = await requireUser();
  return loadInvoiceWorkspace(supabase, invoiceId);
}

export async function getCampaignBillingLines(campaignId: string) {
  const { supabase } = await requireUser();
  return loadCampaignBillingLines(supabase, campaignId);
}

export async function getCampaignBillingGroups(campaignId: string) {
  const { supabase } = await requireUser();
  return loadCampaignBillingGroups(supabase, campaignId);
}

export async function getCampaignOperationalBillingDetail(campaignId: string) {
  const { supabase } = await requireUser();
  return loadCampaignOperationalBillingDetail(supabase, campaignId);
}
