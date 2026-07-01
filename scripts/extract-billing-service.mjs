/**
 * Extract billing module into lib/services/billing/
 * Run: node scripts/extract-billing-service.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const actionsPath = path.join(root, "features/billing/actions.ts");
const queriesPath = path.join(root, "features/billing/queries.ts");
const outDir = path.join(root, "lib/services/billing");
const repoDir = path.join(outDir, "repositories");

fs.mkdirSync(repoDir, { recursive: true });

const actionsSrc = fs.readFileSync(actionsPath, "utf8");
const queriesSrc = fs.readFileSync(queriesPath, "utf8");

// --- Shared helpers ---
fs.writeFileSync(
  path.join(outDir, "billing-helpers.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { parseInvoiceBillingMode } from "@/lib/billing/invoice-validation-context";
import { unlockDeliverablesForInvoice } from "@/lib/billing/sync-deliverable-billing";

export type BillingMutationResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  invoiceId?: string;
  campaignId?: string;
};

export function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

export function buildInvoiceCreateSuccessMessage(input: {
  invoiceMode: ReturnType<typeof parseInvoiceBillingMode>;
  documentNumber: string;
  invoicedRowCount: number;
  requestedLineIds: string[];
  touchedLineIds: string[];
}): string {
  const displayNumber = formatDocumentNumberForDisplay(input.documentNumber);
  const actionLabel = input.invoiceMode === "append" ? "Appended to" : "Created";
  const rowLabel = input.invoicedRowCount === 1 ? "row" : "rows";
  let message = \`\${actionLabel} invoice \${displayNumber} (\${input.invoicedRowCount} \${rowLabel}).\`;

  const touched = new Set(input.touchedLineIds);
  const skippedLineCount = input.requestedLineIds.filter((lineId) => !touched.has(lineId)).length;
  if (skippedLineCount > 0) {
    message += \` \${skippedLineCount} selected assignment\${skippedLineCount === 1 ? "" : "s"} still ha\${skippedLineCount === 1 ? "s" : "ve"} billable rows remaining.\`;
  }

  return message;
}

export function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

export async function rollbackNewInvoiceDraft(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<void> {
  await unlockDeliverablesForInvoice(supabase, invoiceId);
  await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
  await supabase.from("invoices").delete().eq("id", invoiceId);
}
`
);

// --- Approval repository ---
fs.writeFileSync(
  path.join(repoDir, "billing-repository.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";

import { FINANCIAL_APPROVAL_CHAIN } from "@/features/billing/constants";
import { lineBillingPatch } from "../billing-helpers";

export async function fetchLineForBillingApproval(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string
) {
  return supabase
    .from("campaign_lines")
    .select("billing_status, document_number")
    .eq("id", lineId)
    .eq("campaign_header_id", campaignId)
    .maybeSingle();
}

export async function updateLineBillingStatus(
  supabase: SupabaseClient,
  lineId: string,
  billingStatus: string
) {
  return supabase.from("campaign_lines").update({ billing_status: billingStatus }).eq("id", lineId);
}

export async function fetchLineWithHeaderForMove(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string
) {
  return Promise.all([
    supabase
      .from("campaign_lines")
      .select(
        "id, billing_status, document_number, po_amount, cost, revenue_before_vat, revenue, revenue_vat_percent, revenue_vat_amount, revenue_after_vat, revenue_vat_exempt, cost_before_vat, cost_vat_percent, cost_vat_amount, cost_after_vat, cost_vat_exempt, platform, campaign_header_id"
      )
      .eq("id", lineId)
      .eq("campaign_header_id", campaignId)
      .maybeSingle(),
    supabase
      .from("campaign_headers")
      .select(
        "po_amount_campaign_currency, po_consumed_amount, po_remaining_amount, po_remaining_percent, po_status, po_expiry_date, po_override_approved"
      )
      .eq("id", campaignId)
      .maybeSingle(),
  ] as const);
}

export async function fetchSiblingLinesForPo(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("campaign_lines")
    .select(
      "po_amount, revenue_before_vat, revenue, usage_rights_amount, agency_fee_percent, agency_fee_amount"
    )
    .eq("campaign_header_id", campaignId);
}

export async function moveLineToBillingQueue(
  supabase: SupabaseClient,
  lineId: string,
  previousStatus: string
) {
  const { error } = await supabase
    .from("campaign_lines")
    .update({
      billing_status: "moved_to_billing",
      billing_moved_at: new Date().toISOString(),
    })
    .eq("id", lineId);
  if (error) return { error: error.message };
  return { error: null as string | null, previousStatus };
}

export async function revertLineBillingStatus(
  supabase: SupabaseClient,
  lineId: string,
  billingStatus: string
) {
  return supabase.from("campaign_lines").update({ billing_status: billingStatus }).eq("id", lineId);
}

export async function closeBillingLine(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string
) {
  return supabase
    .from("campaign_lines")
    .update(lineBillingPatch("closed"))
    .eq("id", lineId)
    .eq("campaign_header_id", campaignId)
    .in("billing_status", ["paid", "partially_paid"]);
}

export async function grantLineFinanceOverride(
  supabase: SupabaseClient,
  lineId: string,
  until: string
) {
  return supabase
    .from("campaign_lines")
    .update({ finance_override_until: until })
    .eq("id", lineId);
}

export type FinancialApprovalChainInput = {
  entity_type: string;
  entity_id: string;
  title: string;
  description?: string;
  stages?: typeof FINANCIAL_APPROVAL_CHAIN;
};

export async function insertFinancialApprovalChain(
  supabase: SupabaseClient,
  userId: string,
  input: FinancialApprovalChainInput
): Promise<string | null> {
  const stages = input.stages ?? FINANCIAL_APPROVAL_CHAIN;
  for (let i = 0; i < stages.length; i++) {
    const { error } = await supabase.from("financial_approval_requests").insert({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      approval_stage: stages[i],
      chain_order: i + 1,
      title: \`\${input.title} — \${stages[i]}\`,
      description: input.description ?? null,
      requested_by: userId,
      status: "pending",
    });
    if (error) {
      console.error("[billing] financial approval chain insert failed", {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        stage: stages[i],
        message: error.message,
      });
      return error.message;
    }
  }
  return null;
}

export async function decideFinancialApproval(
  supabase: SupabaseClient,
  userId: string,
  input: {
    approval_id: string;
    decision: string;
    decision_notes?: string | null;
  }
) {
  return supabase
    .from("financial_approval_requests")
    .update({
      status: input.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_notes: input.decision_notes ?? null,
    })
    .eq("id", input.approval_id)
    .in("status", ["pending", "in_review"]);
}

export async function approveFinancialRequest(
  supabase: SupabaseClient,
  userId: string,
  approvalId: string
) {
  return supabase
    .from("financial_approval_requests")
    .update({
      status: "approved",
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approvalId);
}
`
);

// --- Invoice repository ---
fs.writeFileSync(
  path.join(repoDir, "invoice-repository.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchCampaignHeaderForInvoice(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("campaign_headers")
    .select("id, client_id, currency_code, name")
    .eq("id", campaignId)
    .maybeSingle();
}

export async function insertInvoiceDraft(
  supabase: SupabaseClient,
  input: {
    client_id: string;
    campaign_header_id: string;
    due_date: string | null;
    currency: string;
    notes: string | null;
    billing_country_code: string | null;
    created_by: string;
  }
) {
  return supabase
    .from("invoices")
    .insert({
      client_id: input.client_id,
      campaign_header_id: input.campaign_header_id,
      status: "draft",
      due_date: input.due_date,
      currency: input.currency,
      notes: input.notes,
      billing_country_code: input.billing_country_code,
      created_by: input.created_by,
    })
    .select("id, document_number")
    .single();
}

export async function fetchInvoiceById(supabase: SupabaseClient, invoiceId: string) {
  return supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
}

export async function fetchInvoiceForUngenerate(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, total, subtotal, tax_amount, version_number, regeneration_status, status, is_operational_locked"
    )
    .eq("id", invoiceId)
    .maybeSingle();
}

export async function fetchInvoiceForRegenerate(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, version_number, regeneration_status"
    )
    .eq("id", invoiceId)
    .maybeSingle();
}

export async function fetchInvoiceLineItems(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order");
}

export async function verifyAppendDeliverableLinks(
  supabase: SupabaseClient,
  invoiceId: string,
  deliverableIds: string[]
) {
  return supabase
    .from("invoice_line_items")
    .select("assignment_deliverable_id")
    .eq("invoice_id", invoiceId)
    .in("assignment_deliverable_id", deliverableIds);
}

export async function countAppendPackageLineItems(
  supabase: SupabaseClient,
  invoiceId: string,
  lineIds: string[]
) {
  return supabase
    .from("invoice_line_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId)
    .in("campaign_line_id", lineIds);
}

export async function countInvoiceLineItems(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoice_line_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);
}

export async function updateInvoiceAfterRegenerate(
  supabase: SupabaseClient,
  invoiceId: string,
  versionNumber: number
) {
  return supabase
    .from("invoices")
    .update({
      version_number: versionNumber,
      regeneration_status: "active",
      status: "draft",
    } as never)
    .eq("id", invoiceId);
}

export async function fetchInvoiceTotals(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select("subtotal, tax_amount, total")
    .eq("id", invoiceId)
    .single();
}
`
);

// --- Payment repository ---
fs.writeFileSync(
  path.join(repoDir, "payment-repository.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchInvoiceForCollection(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select("id, client_id, campaign_header_id, document_number, currency")
    .eq("id", invoiceId)
    .maybeSingle();
}

export async function insertCollectionPayment(
  supabase: SupabaseClient,
  input: {
    invoice_id: string;
    client_id: string;
    amount: number;
    currency: string;
    payment_method: string;
    reference_number: string | null;
    notes: string | null;
    recorded_by: string;
  }
) {
  return supabase.from("payments").insert({
    invoice_id: input.invoice_id,
    client_id: input.client_id,
    amount: input.amount,
    currency: input.currency,
    status: "completed",
    payment_method: input.payment_method,
    reference_number: input.reference_number,
    notes: input.notes,
    paid_at: new Date().toISOString(),
    recorded_by: input.recorded_by,
  });
}

export async function fetchAssignmentForVendorPayment(
  supabase: SupabaseClient,
  assignmentId: string
) {
  return supabase
    .from("campaign_influencers")
    .select("id, agreed_fee, currency, campaign_header_id")
    .eq("id", assignmentId)
    .maybeSingle();
}

export async function insertVendorPaymentBatch(
  supabase: SupabaseClient,
  input: {
    name: string;
    total_amount: number;
    currency: string;
    notes: string | null;
    created_by: string;
  }
) {
  return supabase
    .from("vendor_payment_batches")
    .insert({
      name: input.name,
      status: "completed",
      total_amount: input.total_amount,
      currency: input.currency,
      notes: input.notes,
      created_by: input.created_by,
    })
    .select("id")
    .single();
}

export async function markAssignmentVendorPaid(
  supabase: SupabaseClient,
  assignmentId: string,
  batchId: string
) {
  return supabase
    .from("campaign_influencers")
    .update({
      vendor_payment_status: "paid",
      vendor_paid_at: new Date().toISOString(),
      payment_batch_id: batchId,
    })
    .eq("id", assignmentId);
}
`
);

// --- Statement repository (dashboard reads) ---
fs.writeFileSync(
  path.join(repoDir, "statement-repository.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";

import { REL } from "@/lib/supabase/relation-hints";

export async function fetchDashboardLines(supabase: SupabaseClient) {
  return supabase
    .from("campaign_lines")
    .select(
      \`
        id, document_number, name, campaign_header_id, billing_status,
        revenue, revenue_before_vat, usage_rights_amount, agency_fee_percent, agency_fee_amount,
        cost, profit, po_amount, po_consumed, remaining_po,
        revenue_vat_amount, cost_vat_amount,
        revenue_locked, cost_locked, vendor_assignment_locked,
        currency_code, invoice_id,
        header:\${REL.campaignLines.campaignHeader}(id, name, document_number,
          po_amount_campaign_currency, po_consumed_amount, po_remaining_amount,
          po_remaining_percent, po_status, po_expiry_date,
          client:clients(name),
          brand:brands(name)
        ),
        invoice:invoices(document_number)
      \`
    )
    .order("updated_at", { ascending: false })
    .limit(200);
}

export async function fetchDashboardInvoices(supabase: SupabaseClient) {
  return supabase
    .from("invoices")
    .select(
      \`
        id, document_number, client_id, campaign_header_id, status,
        collection_status, issue_date, due_date, total, amount_paid, currency,
        client:clients(name),
        campaign:\${REL.invoices.campaignHeader}(name)
      \`
    )
    .not("status", "eq", "void")
    .order("issue_date", { ascending: false })
    .limit(100);
}

export async function fetchVendorPaymentBatches(supabase: SupabaseClient) {
  return supabase
    .from("vendor_payment_batches")
    .select("id, document_number, name, status, batch_date, total_amount, currency")
    .order("batch_date", { ascending: false })
    .limit(20);
}

export async function fetchPendingFinancialApprovals(supabase: SupabaseClient) {
  return supabase
    .from("financial_approval_requests")
    .select(
      \`
        id, document_number, entity_type, entity_id, approval_stage,
        chain_order, status, title, decided_at,
        assignee:profiles!financial_approval_requests_assigned_to_fkey(full_name, email)
      \`
    )
    .in("status", ["pending", "in_review"])
    .order("created_at", { ascending: false })
    .limit(30);
}

export async function fetchUnpaidVendorCosts(supabase: SupabaseClient) {
  return supabase
    .from("campaign_influencers")
    .select("agreed_fee, vendor_payment_status")
    .neq("vendor_payment_status", "paid");
}
`
);

// Extract action function bodies
function extractActionBody(actionName) {
  const start = actionsSrc.indexOf(`export async function ${actionName}`);
  if (start === -1) throw new Error(`Missing ${actionName}`);
  let depth = 0;
  let i = actionsSrc.indexOf("{", start);
  const bodyStart = i;
  for (; i < actionsSrc.length; i++) {
    if (actionsSrc[i] === "{") depth++;
    else if (actionsSrc[i] === "}") {
      depth--;
      if (depth === 0) {
        return actionsSrc.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Unbalanced braces for ${actionName}`);
}

function toServiceFn(actionBody, serviceName) {
  return actionBody
    .replace(
      /export async function (\w+)Action\(\s*_prev: BillingActionState,\s*formData: FormData\s*\):\s*Promise<BillingActionState>/,
      `export async function ${serviceName}(\n  supabase: SupabaseClient,\n  userId: string,\n  input: `
    )
    .replace(
      /export async function (\w+)Action\(\s*_prev: BillingActionState,\s*formData: FormData\s*\)/,
      `export async function ${serviceName}(\n  supabase: SupabaseClient,\n  userId: string,\n  input: `
    )
    .replace(
      /export async function grantFinanceOverrideAction\(\s*approvalId: string,\s*lineId: string,\s*hours: number\s*\):\s*Promise<BillingActionState>/,
      `export async function grantFinanceOverride(\n  supabase: SupabaseClient,\n  userId: string,\n  input: { approval_id: string; line_id: string; hours: number }`
    )
    .replace(/Object\.fromEntries\(formData\.entries\(\)\)/g, "input")
    .replace(/parsed\.data\./g, "input.")
    .replace(/parsed\.data/g, "input")
    .replace(/user\.id/g, "userId")
    .replace(/await requireAuthUser\(\)[\s\S]*?return \{ ok: false, message: authError[^}]+\};\s*\}/g, "")
    .replace(/const \{ supabase, user, error: authError \} = await requireAuthUser\(\);[\s\S]*?return \{ ok: false, message: authError[^}]+\};\s*\}/g, "")
    .replace(/const \{ supabase, error: authError \} = await requireAuthUser\(\);[\s\S]*?return \{ ok: false, message: authError \};\s*\}/g, "")
    .replace(/const \{ supabase \} = await requireAuthUser\(\);/g, "")
    .replace(/revalidateBilling\([^)]+\);/g, "")
    .replace(/revalidatePath\([^)]+\);/g, "")
    .replace(/BillingActionState/g, "BillingMutationResult")
    .replace(/await approveLineForBillingAction\(\{ ok: false \}, fd\)/g, "await approveLineForBilling(supabase, userId, { line_id: lineId, campaign_id: input.campaign_id })")
    .replace(/await moveLineToBillingAction\(\{ ok: false \}, fd\)/g, "await moveLineToBilling(supabase, userId, { line_id: lineId, campaign_id: input.campaign_id })");
}

// Copy queries to statement-service.ts (full file minus requireUser wrapper pattern)
const queriesBody = queriesSrc
  .replace(/^import[\s\S]*?from "\.\/types";\n\n/m, "")
  .replace(/async function requireUser\(\)[\s\S]*?\}\n\n/m, "");

fs.writeFileSync(
  path.join(outDir, "statement-service.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";

import { REL } from "@/lib/supabase/relation-hints";
import { resolveOperationalPo } from "@/lib/finance/po/operational-budget";
import { resolveLinePoBillableBase } from "@/lib/finance/po/billable-base";
import type { PoStatus } from "@/lib/finance/po/status";
import {
  assignmentDeliverableBillingSelect,
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deliverableDisplayLabel,
  rollupAssignmentBilling,
  type DeliverableBillingRow,
} from "@/lib/billing/deliverable-billing";
import { queryCampaignLinesWithDisplayOrder } from "@/lib/campaigns/line-ordering";
import {
  parseLineAssignment,
  platformLabel,
} from "@/features/campaigns/line-assignment";
import { resolveBillingKpis } from "@/lib/billing/kpi-enrichment";
import { devLog } from "@/lib/platform/logger";
import { AGING_BUCKET_LABELS } from "@/features/billing/constants";
import { buildCampaignQueueFromBillingLines } from "@/lib/billing/campaign-billing-queue";
import {
  loadCampaignInvoiceLineRollups,
  reconcileCampaignRollupWithInvoiceLines,
} from "@/lib/billing/invoice-operational-aggregation";
import { loadBillingCampaignQueue, loadCampaignOperationalBilling } from "@/lib/billing/operational-billing-query";
import {
  computeAgingBucket,
  formatMarginPercent,
  type AgingBucket,
  type AssignmentBillingGroup,
  type BillingDashboard,
  type BillingInvoiceRow,
  type BillingLineRow,
  type CampaignLineBillingStatus,
  type CampaignOperationalBillingDetail,
  type FinancialApprovalRow,
  type VendorPaymentBatchRow,
} from "@/features/billing/types";

import {
  fetchDashboardInvoices,
  fetchDashboardLines,
  fetchPendingFinancialApprovals,
  fetchUnpaidVendorCosts,
  fetchVendorPaymentBatches,
} from "./repositories/statement-repository";

${queriesBody.replace(/const \{ supabase \} = await requireUser\(\);/g, "// supabase passed in")}
`
  .replace(
    /export async function getBillingDashboard\(\): Promise<BillingDashboard> \{\n  const \{ supabase \} = await requireUser\(\);/,
    "export async function getBillingDashboard(supabase: SupabaseClient): Promise<BillingDashboard> {"
  )
  .replace(
    /export async function getInvoiceWorkspace\([\s\S]*?\n\}/,
    "// getInvoiceWorkspace moved to invoice-service.ts"
  )
);

console.log("Base files written. Run manual service assembly for invoice/billing actions.");
