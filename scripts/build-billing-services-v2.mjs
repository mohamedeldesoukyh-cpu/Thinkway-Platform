/**
 * Clean billing service extraction — copies function bodies with minimal transforms.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const actionsSrc = fs.readFileSync(path.join(root, "features/billing/actions.ts"), "utf8");
const queriesSrc = fs.readFileSync(path.join(root, "features/billing/queries.ts"), "utf8");
const outDir = path.join(root, "lib/services/billing");

function extractFn(src, name) {
  const start = src.indexOf(`export async function ${name}`);
  if (start < 0) throw new Error(`Missing ${name}`);
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced ${name}`);
}

function fnBody(fnText) {
  const open = fnText.indexOf("{");
  const close = fnText.lastIndexOf("}");
  return fnText.slice(open + 1, close);
}

function transformBody(body, opts = {}) {
  let b = body;
  // Remove auth block
  b = b.replace(
    /\s*const \{ supabase, user, error: authError \} = await requireAuthUser\(\);\s*if \(authError \|\| !user\) \{\s*return \{ ok: false, message: authError \?\? "Unauthorized" \};\s*\}\s*/g,
    ""
  );
  b = b.replace(
    /\s*const \{ supabase, error: authError \} = await requireAuthUser\(\);\s*if \(authError \|\| !user\) \{\s*return \{ ok: false, message: authError \?\? "Unauthorized" \};\s*\}\s*/g,
    ""
  );
  b = b.replace(
    /\s*const \{ supabase, error: authError \} = await requireAuthUser\(\);\s*if \(authError\) \{\s*return \{ ok: false, message: authError \};\s*\}\s*/g,
    ""
  );
  b = b.replace(/\s*const \{ supabase \} = await requireAuthUser\(\);\s*/g, "");
  b = b.replace(/Object\.fromEntries\(formData\.entries\(\)\)/g, "input");
  // Remove schema parse (non-greedy safeParse args — match through entries())
  b = b.replace(
    /\s*const parsed = \w+Schema\.safeParse\(\s*[\s\S]*?\);\s*if \(!parsed\.success\) \{[\s\S]*?\}\s*/g,
    ""
  );
  b = b.replace(/parsed\.data\./g, "input.");
  b = b.replace(/parsed\.data/g, "input");
  b = b.replace(/user\.id/g, "userId");
  b = b.replace(/BillingActionState/g, "BillingMutationResult");
  b = b.replace(/revalidateBilling\([^)]*\);\s*/g, "");
  b = b.replace(/revalidatePath\([^)]*\);\s*/g, "");
  b = b.replace(/createFinancialApprovalChain\(/g, "insertFinancialApprovalChain(");
  b = b.replace(/^\s*;\s*\}\s*/m, "");
  b = b.replace(/\{\s*;\s*\}/g, "{");
  if (opts.bulkApprove) {
    b = b.replace(
      /const fd = new FormData\(\);\s*fd\.set\("line_id", lineId\);\s*fd\.set\("campaign_id", input\.campaign_id\);\s*const result = await approveLineForBillingAction\(\{ ok: false \}, fd\);/g,
      "const result = await approveLineForBilling(supabase, userId, { line_id: lineId, campaign_id: input.campaign_id });"
    );
  }
  if (opts.bulkMove) {
    b = b.replace(
      /const fd = new FormData\(\);\s*fd\.set\("line_id", lineId\);\s*fd\.set\("campaign_id", input\.campaign_id\);\s*const result = await moveLineToBillingAction\(\{ ok: false \}, fd\);/g,
      "const result = await moveLineToBilling(supabase, userId, { line_id: lineId, campaign_id: input.campaign_id });"
    );
  }
  return b;
}

function wrapFn(name, params, returnType, body) {
  return `export async function ${name}(${params}): ${returnType} {${body}\n}`;
}

// --- helpers already exist ---

const billingImports = `import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveOperationalPo } from "@/lib/finance/po/operational-budget";
import { resolveLinePoBillableBase } from "@/lib/finance/po/billable-base";
import {
  ensureBillableDeliverablesForLine,
  markDeliverablesReadyToInvoice,
} from "@/lib/billing/sync-deliverable-billing";
import {
  approveOperationalRows,
  markOperationalRowsReadyToInvoice,
  resolveBulkBillingTargets,
} from "@/lib/billing/sync-operational-row-billing";
import { lineBillingPatch, type BillingMutationResult } from "./billing-helpers";
import { insertFinancialApprovalChain } from "./repositories/billing-repository";
import type { z } from "zod";
import type {
  approveLineForBillingSchema,
  bulkOperationalBillingSchema,
  closeBillingLineSchema,
  moveLineToBillingSchema,
} from "@/features/billing/schemas";
`;

const billingFns = [
  ["approveLineForBillingAction", "approveLineForBilling", "z.infer<typeof approveLineForBillingSchema>", {}],
  ["moveLineToBillingAction", "moveLineToBilling", "z.infer<typeof moveLineToBillingSchema>", {}],
  ["bulkApproveOperationalBillingAction", "bulkApproveOperationalBilling", "z.infer<typeof bulkOperationalBillingSchema>", { bulkApprove: true }],
  ["bulkMoveOperationalBillingAction", "bulkMoveOperationalBilling", "z.infer<typeof bulkOperationalBillingSchema>", { bulkMove: true }],
  ["closeBillingLineAction", "closeBillingLine", "z.infer<typeof closeBillingLineSchema>", {}],
];

let billingSvc = billingImports + "\n";
for (const [action, svc, inputType, opts] of billingFns) {
  const body = transformBody(fnBody(extractFn(actionsSrc, action)), opts);
  billingSvc +=
    wrapFn(
      svc,
      `supabase: SupabaseClient, userId: string, input: ${inputType}`,
      "Promise<BillingMutationResult>",
      body
    ) + "\n\n";
}

// Append query functions — extract helpers + campaign query fns only
const queryHelpers = queriesSrc.match(/type LineQueryRow[\s\S]*?(?=export async function getBillingDashboard)/)?.[0] ?? "";

const billingQueryImports = `
import { REL } from "@/lib/supabase/relation-hints";
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
import { parseLineAssignment, platformLabel } from "@/features/campaigns/line-assignment";
import { devLog } from "@/lib/platform/logger";
import {
  loadCampaignInvoiceLineRollups,
  reconcileCampaignRollupWithInvoiceLines,
} from "@/lib/billing/invoice-operational-aggregation";
import { loadCampaignOperationalBilling } from "@/lib/billing/operational-billing-query";
import {
  formatMarginPercent,
  type AssignmentBillingGroup,
  type BillingLineRow,
  type CampaignLineBillingStatus,
  type CampaignOperationalBillingDetail,
} from "@/features/billing/types";
`;

const campaignQueryFns = ["getCampaignBillingLines", "getCampaignBillingGroups", "getCampaignOperationalBillingDetail"];
let queryAppend = billingQueryImports + "\n" + queryHelpers + "\n";
for (const qfn of campaignQueryFns) {
  let fn = extractFn(queriesSrc, qfn);
  fn = fn
    .replace(
      new RegExp(`export async function ${qfn}\\(\\n  campaignId: string\\n\\)`),
      `export async function ${qfn}(supabase: SupabaseClient, campaignId: string)`
    )
    .replace(/const \{ supabase \} = await requireUser\(\);\n\n/g, "");
  queryAppend += fn + "\n\n";
}

billingSvc += queryAppend;
fs.writeFileSync(path.join(outDir, "billing-service.ts"), billingSvc);

// Invoice service
const invoiceImports = `import type { SupabaseClient } from "@supabase/supabase-js";

import { REL } from "@/lib/supabase/relation-hints";
import { governanceDb } from "@/lib/supabase/governance-client";
import { resolveClientBillingVatRate } from "@/lib/vat/queries";
import {
  fetchDeliverablesForInvoicing,
  insertPackageAssignmentLineItems,
  lineHasAssignmentDeliverables,
  lockDeliverablesOnInvoice,
  assertInvoiceHasBillableLineItems,
  regenerateInvoiceLineItems,
  prepareLinesForDeliverableInvoicing,
  validateDeliverablesForInvoice,
} from "@/lib/billing/invoice-from-deliverables";
import {
  fetchPostsForInvoicing,
  lockPostsOnInvoice,
  preparePostsForInvoiceValidation,
  validatePostsForInvoice,
} from "@/lib/billing/invoice-from-posts";
import { repairDesyncedUngeneratedInvoiceHeaders } from "@/lib/billing/repair-orphaned-invoice-state";
import { runPreInvoiceCreateRepairPipeline } from "@/lib/billing/repair-invoice-create-pipeline";
import {
  resolveOperationalInvoiceTargets,
  validateAppendableInvoice,
} from "@/lib/billing/resolve-operational-invoice";
import { invoiceUngenerateIneligibleReason } from "@/lib/billing/invoice-ungenerate-eligibility";
import { blockInvoiceWithoutVendorIoMessage } from "@/lib/billing/line-invoice-eligibility";
import { resolveScopedInvoiceLineIds } from "@/lib/billing/invoice-validation-scope";
import {
  buildInvoiceValidationContext,
  invoicedRowAllowed,
  isInvoicedOperationalRow,
  parseInvoiceBillingMode,
} from "@/lib/billing/invoice-validation-context";
import { commitInvoiceLifecycleMutation } from "@/lib/billing/invoice-lifecycle-commit";
import type { InvoiceLineItemOpSummary } from "@/lib/billing/invoice-lifecycle-debug";
import { requirePermission } from "@/lib/auth/permissions";
import type { z } from "zod";
import type {
  createInvoiceFromLinesSchema,
  regenerateInvoiceSchema,
  ungenerateInvoiceSchema,
} from "@/features/billing/schemas";
import type { FinancialApprovalRow, InvoiceWorkspace } from "@/features/billing/types";
import {
  buildInvoiceCreateSuccessMessage,
  emptyToNull,
  rollbackNewInvoiceDraft,
  type BillingMutationResult,
} from "./billing-helpers";
import { insertFinancialApprovalChain } from "./repositories/billing-repository";
`;

const invoiceActions = [
  ["createInvoiceFromLinesAction", "createInvoiceFromLines", "z.infer<typeof createInvoiceFromLinesSchema>"],
  ["ungenerateInvoiceAction", "ungenerateInvoice", "z.infer<typeof ungenerateInvoiceSchema>"],
  ["regenerateInvoiceAction", "regenerateInvoice", "z.infer<typeof regenerateInvoiceSchema>"],
];

let invoiceSvc = invoiceImports + "\n";
for (const [action, svc, inputType] of invoiceActions) {
  const body = transformBody(fnBody(extractFn(actionsSrc, action)));
  invoiceSvc +=
    wrapFn(
      svc,
      `supabase: SupabaseClient, userId: string, input: ${inputType}`,
      "Promise<BillingMutationResult>",
      body
    ) + "\n\n";
}

const invoiceWs = extractFn(queriesSrc, "getInvoiceWorkspace")
  .replace(
    /export async function getInvoiceWorkspace\(\n  invoiceId: string\n\)/,
    "export async function getInvoiceWorkspace(supabase: SupabaseClient, invoiceId: string)"
  )
  .replace(/const \{ supabase \} = await requireUser\(\);\n\n/g, "");
if (invoiceWs) {
  invoiceSvc += "\n\n" + invoiceWs;
}
fs.writeFileSync(path.join(outDir, "invoice-service.ts"), invoiceSvc);

// Approval, collection, vendor
const approvalImports = `import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { decideFinancialApprovalSchema, requestFinanceOverrideSchema } from "@/features/billing/schemas";
import { emptyToNull, type BillingMutationResult } from "./billing-helpers";
import { insertFinancialApprovalChain } from "./repositories/billing-repository";
`;

let approvalSvc = approvalImports + "\n";
for (const [action, svc, inputType] of [
  ["decideFinancialApprovalAction", "decideFinancialApproval", "z.infer<typeof decideFinancialApprovalSchema>"],
  ["requestFinanceOverrideAction", "requestFinanceOverride", "z.infer<typeof requestFinanceOverrideSchema>"],
]) {
  approvalSvc += wrapFn(svc, `supabase: SupabaseClient, userId: string, input: ${inputType}`, "Promise<BillingMutationResult>", transformBody(fnBody(extractFn(actionsSrc, action)))) + "\n\n";
}
approvalSvc += wrapFn(
  "grantFinanceOverride",
  "supabase: SupabaseClient, userId: string, input: { approval_id: string; line_id: string; hours: number }",
  "Promise<BillingMutationResult>",
  transformBody(fnBody(extractFn(actionsSrc, "grantFinanceOverrideAction")))
    .replace(/approvalId/g, "input.approval_id")
    .replace(/\blineId\b/g, "input.line_id")
    .replace(/\bhours\b/g, "input.hours")
);
fs.writeFileSync(path.join(outDir, "approval-service.ts"), approvalSvc);

const collectionSvc = `import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { recordCollectionPaymentSchema } from "@/features/billing/schemas";
import { syncDeliverableCollectionsForInvoice } from "@/lib/billing/sync-deliverable-collections";
import { emptyToNull, type BillingMutationResult } from "./billing-helpers";

${wrapFn(
  "recordCollectionPayment",
  "supabase: SupabaseClient, userId: string, input: z.infer<typeof recordCollectionPaymentSchema>",
  "Promise<BillingMutationResult>",
  transformBody(fnBody(extractFn(actionsSrc, "recordCollectionPaymentAction"))).replace(
    /return \{\s*ok: true,\s*message: `Payment recorded for \$\{invoice\.document_number\}\.`\s*,?\s*\};/,
    "return { ok: true, message: `Payment recorded for ${invoice.document_number}.`, invoiceId: invoice.id, campaignId: invoice.campaign_header_id ?? undefined };"
  )
)}
`;
fs.writeFileSync(path.join(outDir, "collection-service.ts"), collectionSvc);

const vendorSvc = `import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { recordVendorPaymentSchema } from "@/features/billing/schemas";
import { emptyToNull, type BillingMutationResult } from "./billing-helpers";

${wrapFn(
  "recordVendorPayment",
  "supabase: SupabaseClient, userId: string, input: z.infer<typeof recordVendorPaymentSchema>",
  "Promise<BillingMutationResult>",
  transformBody(fnBody(extractFn(actionsSrc, "recordVendorPaymentAction")))
)}
`;
fs.writeFileSync(path.join(outDir, "vendor-payment-service.ts"), vendorSvc);

// Statement service (dashboard)
const stmtHeader = queriesSrc
  .split("type LineQueryRow")[0]
  .replace(/import \{ createSupabaseServerClient \}[\s\S]*?\n\nasync function requireUser\(\)[\s\S]*?\n\}\n\n/, "")
  .replace(/from "\.\/constants"/g, 'from "@/features/billing/constants"')
  .replace(/from "\.\/types"/g, 'from "@/features/billing/types"');

const dashboardHelpers = queriesSrc.match(/type LineQueryRow[\s\S]*?(?=export async function getBillingDashboard)/)?.[0] ?? "";
const dashboardFn = extractFn(queriesSrc, "getBillingDashboard")
  .replace(
    "export async function getBillingDashboard()",
    "export async function getBillingDashboard(supabase: SupabaseClient)"
  )
  .replace(/const \{ supabase \} = await requireUser\(\);\n\n/g, "");

fs.writeFileSync(
  path.join(outDir, "statement-service.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";\n\n${stmtHeader}${dashboardHelpers}\n${dashboardFn}`
);

// Thin actions + queries + index + test
const thinActions = `"use server";

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
  if (paths.campaignId) revalidatePath(\`/campaigns/\${paths.campaignId}\`);
  if (paths.invoiceId) revalidatePath(\`/billing/invoices/\${paths.invoiceId}\`);
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
`;

fs.writeFileSync(path.join(root, "features/billing/actions.ts"), thinActions);

const thinQueries = `import { createSupabaseServerClient } from "@/lib/supabase/server";
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
`;
fs.writeFileSync(path.join(root, "features/billing/queries.ts"), thinQueries);

fs.writeFileSync(path.join(outDir, "index.ts"), `export type { BillingMutationResult } from "./billing-helpers";
export {
  approveLineForBilling,
  bulkApproveOperationalBilling,
  bulkMoveOperationalBilling,
  closeBillingLine,
  getCampaignBillingGroups,
  getCampaignBillingLines,
  getCampaignOperationalBillingDetail,
  moveLineToBilling,
} from "./billing-service";
export {
  createInvoiceFromLines,
  getInvoiceWorkspace,
  regenerateInvoice,
  ungenerateInvoice,
} from "./invoice-service";
export { recordCollectionPayment } from "./collection-service";
export { recordVendorPayment } from "./vendor-payment-service";
export {
  decideFinancialApproval,
  grantFinanceOverride,
  requestFinanceOverride,
} from "./approval-service";
export { getBillingDashboard } from "./statement-service";
`);

fs.writeFileSync(path.join(outDir, "billing-service-layer.test.ts"), `import assert from "node:assert/strict";
import { emptyToNull, buildInvoiceCreateSuccessMessage, lineBillingPatch } from "./billing-helpers";
import { parseInvoiceBillingMode } from "@/lib/billing/invoice-validation-context";

async function main() {
  assert.equal(emptyToNull(""), null);
  assert.equal(emptyToNull("  notes  "), "notes");
  assert.deepEqual(lineBillingPatch("closed"), { billing_status: "closed", assignment_status: "closed" });
  const msg = buildInvoiceCreateSuccessMessage({
    invoiceMode: parseInvoiceBillingMode("new"),
    documentNumber: "TW-INV-2026-0001",
    invoicedRowCount: 2,
    requestedLineIds: ["a", "b", "c"],
    touchedLineIds: ["a", "b"],
  });
  assert.ok(msg.includes("Created invoice"));
  assert.ok(msg.includes("1 selected assignment"));
  console.log("billing-service-layer.test.ts: all assertions passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
`);

// Delete orphan file
try { fs.unlinkSync(path.join(outDir, "invoice-service-queries.ts")); } catch {}

console.log("Clean extraction complete");
