"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  approveLineForBilling,
  bulkApproveOperationalBilling,
  bulkMoveOperationalBilling,
  closeBillingLine,
  getCampaignOperationalBillingDetail,
  moveLineToBilling,
} from "@/lib/services/billing/billing-service";
import {
  createInvoiceFromLines,
  regenerateInvoice,
  ungenerateInvoice,
} from "@/lib/services/billing/invoice-service";
import { recordCollectionPayment } from "@/lib/services/billing/collection-service";
import { recordVendorPayment } from "@/lib/services/billing/vendor-payment-service";
import {
  decideFinancialApproval,
  grantFinanceOverride,
  requestFinanceOverride,
} from "@/lib/services/billing/approval-service";
import { runPreInvoiceCreateRepairPipeline } from "@/lib/billing/repair-invoice-create-pipeline";
import {
  approveLineForBillingSchema,
  bulkOperationalBillingSchema,
  closeBillingLineSchema,
  createInvoiceFromLinesSchema,
  decideFinancialApprovalSchema,
  moveLineToBillingSchema,
  recordCollectionPaymentSchema,
  recordVendorPaymentSchema,
  regenerateInvoiceSchema,
  requestFinanceOverrideSchema,
  ungenerateInvoiceSchema,
} from "./schemas";

export type BillingActionState = import("@/lib/services/billing/billing-helpers").BillingMutationResult;

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  return { supabase, user, error: null };
}

function revalidateBilling(paths: { campaignId?: string; invoiceId?: string }) {
  revalidatePath("/billing");
  if (paths.campaignId) revalidatePath(`/campaigns/${paths.campaignId}`);
  if (paths.invoiceId) revalidatePath(`/billing/invoices/${paths.invoiceId}`);
}

export async function approveLineForBillingAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = approveLineForBillingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await approveLineForBilling(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ campaignId: parsed.data.campaign_id });
  return result;
}

export async function moveLineToBillingAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = moveLineToBillingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await moveLineToBilling(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ campaignId: parsed.data.campaign_id });
  return result;
}

export async function bulkApproveOperationalBillingAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = bulkOperationalBillingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Invalid bulk approve request." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await bulkApproveOperationalBilling(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ campaignId: parsed.data.campaign_id });
  return result;
}

export async function bulkMoveOperationalBillingAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = bulkOperationalBillingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Invalid bulk move request." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await bulkMoveOperationalBilling(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ campaignId: parsed.data.campaign_id });
  return result;
}

export async function createInvoiceFromLinesAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = createInvoiceFromLinesSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await createInvoiceFromLines(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ campaignId: parsed.data.campaign_id, invoiceId: result.invoiceId });
  return result;
}

export async function recordCollectionPaymentAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = recordCollectionPaymentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await recordCollectionPayment(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ invoiceId: parsed.data.invoice_id, campaignId: result.campaignId });
  return result;
}

export async function recordVendorPaymentAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = recordVendorPaymentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await recordVendorPayment(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ campaignId: parsed.data.campaign_id });
  return result;
}

export async function decideFinancialApprovalAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = decideFinancialApprovalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await decideFinancialApproval(supabase, user.id, parsed.data);
  if (result.ok) revalidatePath("/billing");
  return result;
}

export async function requestFinanceOverrideAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = requestFinanceOverrideSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await requestFinanceOverride(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ campaignId: parsed.data.campaign_id });
  return result;
}

export async function grantFinanceOverrideAction(approvalId: string, lineId: string, hours: number): Promise<BillingActionState> {
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await grantFinanceOverride(supabase, user.id, { approval_id: approvalId, line_id: lineId, hours });
  if (result.ok) revalidatePath("/billing");
  return result;
}

export async function closeBillingLineAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = closeBillingLineSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { supabase, error: authError } = await requireAuthUser();
  if (authError) return { ok: false, message: authError };
  const result = await closeBillingLine(supabase, "", parsed.data);
  if (result.ok) revalidateBilling({ campaignId: parsed.data.campaign_id });
  return result;
}

export async function ungenerateInvoiceAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = ungenerateInvoiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Reason is required (min 3 characters)." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await ungenerateInvoice(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ invoiceId: parsed.data.invoice_id, campaignId: result.campaignId });
  return result;
}

export async function regenerateInvoiceAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const parsed = regenerateInvoiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "Reason is required (min 3 characters)." };
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) return { ok: false, message: authError ?? "Unauthorized" };
  const result = await regenerateInvoice(supabase, user.id, parsed.data);
  if (result.ok) revalidateBilling({ invoiceId: parsed.data.invoice_id, campaignId: result.campaignId });
  return result;
}

export async function loadCampaignBillingDetailAction(campaignId: string) {
  try {
    const { supabase } = await requireAuthUser();
    const detail = await getCampaignOperationalBillingDetail(supabase, campaignId);
    if (process.env.NODE_ENV === "development" && detail) {
      console.debug("[billing-drilldown] expansion loaded", { campaignId, rows: detail.operational_rows.length });
    }
    return { ok: true as const, detail };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Failed to load drill-down." };
  }
}

export async function refreshBillingAfterInvoiceAction(campaignId: string) {
  const { supabase, error: authError } = await requireAuthUser();
  if (!authError && supabase) await runPreInvoiceCreateRepairPipeline(supabase, campaignId);
  revalidateBilling({ campaignId });
  return loadCampaignBillingDetailAction(campaignId);
}
