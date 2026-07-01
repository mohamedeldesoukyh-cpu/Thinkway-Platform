/**
 * Full billing service layer extraction.
 * Run: node scripts/build-billing-services.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const actionsPath = path.join(root, "features/billing/actions.ts");
const queriesPath = path.join(root, "features/billing/queries.ts");
const outDir = path.join(root, "lib/services/billing");

const actionsSrc = fs.readFileSync(actionsPath, "utf8");
const queriesSrc = fs.readFileSync(queriesPath, "utf8");

function extractFn(src, fnName) {
  const marker = `export async function ${fnName}`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${fnName}`);
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced ${fnName}`);
}

function stripAuthAndRevalidate(body) {
  return body
    .replace(
      /\s*const \{ supabase, user, error: authError \} = await requireAuthUser\(\);\s*if \(authError \|\| !user\) \{\s*return \{ ok: false, message: authError \?\? "Unauthorized" \};\s*\}\s*/g,
      ""
    )
    .replace(
      /\s*const \{ supabase, error: authError \} = await requireAuthUser\(\);\s*if \(authError \|\| !user\) \{\s*return \{ ok: false, message: authError \?\? "Unauthorized" \};\s*\}\s*/g,
      ""
    )
    .replace(
      /\s*const \{ supabase, error: authError \} = await requireAuthUser\(\);\s*if \(authError\) \{\s*return \{ ok: false, message: authError \};\s*\}\s*/g,
      ""
    )
    .replace(/\s*const \{ supabase \} = await requireAuthUser\(\);\s*/g, "")
    .replace(/\s*revalidateBilling\([^)]*\);\s*/g, "")
    .replace(/\s*revalidatePath\([^)]*\);\s*/g, "");
}

const SERVICE_IMPORTS = {
  "billing-service.ts": `import type { SupabaseClient } from "@supabase/supabase-js";

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
import type { z } from "zod";
import type {
  approveLineForBillingSchema,
  bulkOperationalBillingSchema,
  closeBillingLineSchema,
  moveLineToBillingSchema,
} from "@/features/billing/schemas";

import {
  fetchLineForBillingApproval,
  fetchLineWithHeaderForMove,
  fetchSiblingLinesForPo,
  insertFinancialApprovalChain,
  moveLineToBillingQueue,
  revertLineBillingStatus,
  closeBillingLine as closeBillingLineRepo,
  updateLineBillingStatus,
} from "./repositories/billing-repository";
import type { BillingMutationResult } from "./billing-helpers";

type ApproveLineInput = z.infer<typeof approveLineForBillingSchema>;
type MoveLineInput = z.infer<typeof moveLineToBillingSchema>;
type BulkInput = z.infer<typeof bulkOperationalBillingSchema>;
type CloseLineInput = z.infer<typeof closeBillingLineSchema>;
`,
  "invoice-service.ts": `import type { SupabaseClient } from "@supabase/supabase-js";

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
import type {
  FinancialApprovalRow,
  InvoiceWorkspace,
} from "@/features/billing/types";
import {
  buildInvoiceCreateSuccessMessage,
  emptyToNull,
  rollbackNewInvoiceDraft,
  type BillingMutationResult,
} from "./billing-helpers";
import { insertFinancialApprovalChain } from "./repositories/billing-repository";
`,
  "collection-service.ts": `import type { SupabaseClient } from "@supabase/supabase-js";

import { syncDeliverableCollectionsForInvoice } from "@/lib/billing/sync-deliverable-collections";
import type { z } from "zod";
import type { recordCollectionPaymentSchema } from "@/features/billing/schemas";

import { emptyToNull, type BillingMutationResult } from "./billing-helpers";
import {
  fetchInvoiceForCollection,
  insertCollectionPayment,
} from "./repositories/payment-repository";

type CollectionInput = z.infer<typeof recordCollectionPaymentSchema>;
`,
  "vendor-payment-service.ts": `import type { SupabaseClient } from "@supabase/supabase-js";

import type { z } from "zod";
import type { recordVendorPaymentSchema } from "@/features/billing/schemas";

import { emptyToNull, type BillingMutationResult } from "./billing-helpers";
import {
  fetchAssignmentForVendorPayment,
  insertVendorPaymentBatch,
  markAssignmentVendorPaid,
} from "./repositories/payment-repository";

type VendorPaymentInput = z.infer<typeof recordVendorPaymentSchema>;
`,
  "approval-service.ts": `import type { SupabaseClient } from "@supabase/supabase-js";

import type { z } from "zod";
import type {
  decideFinancialApprovalSchema,
  requestFinanceOverrideSchema,
} from "@/features/billing/schemas";

import { emptyToNull, type BillingMutationResult } from "./billing-helpers";
import {
  approveFinancialRequest,
  decideFinancialApproval as decideFinancialApprovalRepo,
  grantLineFinanceOverride,
  insertFinancialApprovalChain,
} from "./repositories/billing-repository";

type DecideInput = z.infer<typeof decideFinancialApprovalSchema>;
type OverrideRequestInput = z.infer<typeof requestFinanceOverrideSchema>;
`,
};

// Build invoice-service from action bodies
const invoiceFns = [
  "createInvoiceFromLinesAction",
  "ungenerateInvoiceAction",
  "regenerateInvoiceAction",
];

let invoiceBody = SERVICE_IMPORTS["invoice-service.ts"];

for (const fn of invoiceFns) {
  const svcName = fn.replace(/Action$/, "");
  let body = stripAuthAndRevalidate(extractFn(actionsSrc, fn))
    .replace(`export async function ${fn}`, `export async function ${svcName}`)
    .replace(/Object\.fromEntries\(formData\.entries\(\)\)/g, "input")
    .replace(/const parsed = \w+Schema\.safeParse\([\s\S]*?if \(!parsed\.success\) \{[\s\S]*?\}\s*/m, "")
    .replace(/parsed\.data\./g, "input.")
    .replace(/parsed\.data/g, "input")
    .replace(/BillingActionState/g, "BillingMutationResult")
    .replace(/user\.id/g, "userId")
    .replace(/createFinancialApprovalChain\(/g, "insertFinancialApprovalChain(");

  if (fn === "createInvoiceFromLinesAction") {
    body = body.replace(
      /\(\s*_prev: BillingMutationResult,\s*formData: FormData\s*\):\s*Promise<BillingMutationResult>/,
      "(supabase: SupabaseClient, userId: string, input: z.infer<typeof createInvoiceFromLinesSchema>): Promise<BillingMutationResult>"
    );
  } else if (fn === "grantFinanceOverrideAction") {
    // skip
  } else {
    body = body.replace(
      /\(\s*_prev: BillingMutationResult,\s*formData: FormData\s*\):\s*Promise<BillingMutationResult>/,
      `(supabase: SupabaseClient, userId: string, input: z.infer<typeof ${fn === "ungenerateInvoiceAction" ? "ungenerateInvoiceSchema" : "regenerateInvoiceSchema"}>): Promise<BillingMutationResult>`
    );
  }

  invoiceBody += "\n\n" + body;
}

fs.writeFileSync(path.join(outDir, "invoice-service.ts"), invoiceBody);

// Billing service functions
const billingActionFns = [
  ["approveLineForBillingAction", "approveLineForBilling", "ApproveLineInput"],
  ["moveLineToBillingAction", "moveLineToBilling", "MoveLineInput"],
  ["bulkApproveOperationalBillingAction", "bulkApproveOperationalBilling", "BulkInput"],
  ["bulkMoveOperationalBillingAction", "bulkMoveOperationalBilling", "BulkInput"],
  ["closeBillingLineAction", "closeBillingLine", "CloseLineInput"],
];

let billingBody = SERVICE_IMPORTS["billing-service.ts"];
for (const [action, svc, type] of billingActionFns) {
  let fn = stripAuthAndRevalidate(extractFn(actionsSrc, action));
  fn = fn
    .replace(`export async function ${action}`, `export async function ${svc}`)
    .replace(
      /\(\s*_prev: BillingActionState,\s*formData: FormData\s*\):\s*Promise<BillingActionState>/,
      `(supabase: SupabaseClient, userId: string, input: ${type}): Promise<BillingMutationResult>`
    )
    .replace(/Object\.fromEntries\(formData\.entries\(\)\)/g, "input")
    .replace(/const parsed = \w+Schema\.safeParse\(\s*input\s*\);[\s\S]*?if \(!parsed\.success\) \{[\s\S]*?\}\s*/m, "")
    .replace(/parsed\.data\./g, "input.")
    .replace(/parsed\.data/g, "input")
    .replace(/user\.id/g, "userId")
    .replace(/BillingActionState/g, "BillingMutationResult")
    .replace(/createFinancialApprovalChain\(/g, "insertFinancialApprovalChain(")
    .replace(/await approveLineForBillingAction\(\{ ok: false \}, fd\)/g, "await approveLineForBilling(supabase, userId, { line_id: lineId, campaign_id: input.campaign_id })")
    .replace(/await moveLineToBillingAction\(\{ ok: false \}, fd\)/g, "await moveLineToBilling(supabase, userId, { line_id: lineId, campaign_id: input.campaign_id })")
    .replace(/const fd = new FormData\(\);\s*fd\.set\("line_id", lineId\);\s*fd\.set\("campaign_id", parsed\.data\.campaign_id\);\s*/g, "")
    .replace(/const fd = new FormData\(\);\s*fd\.set\("line_id", lineId\);\s*fd\.set\("campaign_id", input\.campaign_id\);\s*/g, "");
  billingBody += "\n\n" + fn;
}
fs.writeFileSync(path.join(outDir, "billing-service.ts"), billingBody);

// Smaller services
const smallServices = [
  ["collection-service.ts", "recordCollectionPaymentAction", "recordCollectionPayment", "CollectionInput"],
  ["vendor-payment-service.ts", "recordVendorPaymentAction", "recordVendorPayment", "VendorPaymentInput"],
  ["approval-service.ts", "decideFinancialApprovalAction", "decideFinancialApproval", "DecideInput"],
  ["approval-service.ts", "requestFinanceOverrideAction", "requestFinanceOverride", "OverrideRequestInput"],
];

const approvalExtra = stripAuthAndRevalidate(extractFn(actionsSrc, "grantFinanceOverrideAction"))
  .replace("export async function grantFinanceOverrideAction", "export async function grantFinanceOverride")
  .replace(
    /\(approvalId: string,\s*lineId: string,\s*hours: number\):\s*Promise<BillingActionState>/,
    "(supabase: SupabaseClient, userId: string, input: { approval_id: string; line_id: string; hours: number }): Promise<BillingMutationResult>"
  )
  .replace(/approvalId/g, "input.approval_id")
  .replace(/lineId/g, "input.line_id")
  .replace(/hours/g, "input.hours")
  .replace(/user\.id/g, "userId")
  .replace(/BillingActionState/g, "BillingMutationResult");

const written = new Set();
for (const [file, action, svc, type] of smallServices) {
  let fn = stripAuthAndRevalidate(extractFn(actionsSrc, action));
  fn = fn
    .replace(`export async function ${action}`, `export async function ${svc}`)
    .replace(
      /\(\s*_prev: BillingActionState,\s*formData: FormData\s*\):\s*Promise<BillingActionState>/,
      `(supabase: SupabaseClient, userId: string, input: ${type}): Promise<BillingMutationResult>`
    )
    .replace(/Object\.fromEntries\(formData\.entries\(\)\)/g, "input")
    .replace(/const parsed = \w+Schema\.safeParse\([\s\S]*?if \(!parsed\.success\) \{[\s\S]*?\}\s*/m, "")
    .replace(/parsed\.data\./g, "input.")
    .replace(/parsed\.data/g, "input")
    .replace(/user\.id/g, "userId")
    .replace(/BillingActionState/g, "BillingMutationResult")
    .replace(/createFinancialApprovalChain\(/g, "insertFinancialApprovalChain(");

  if (!written.has(file)) {
    fs.writeFileSync(path.join(outDir, file), SERVICE_IMPORTS[file] + "\n\n" + fn);
    written.add(file);
  } else {
    fs.appendFileSync(path.join(outDir, file), "\n\n" + fn);
  }
}
fs.appendFileSync(path.join(outDir, "approval-service.ts"), "\n\n" + approvalExtra);

// billing-service.ts for queries - copy queries with supabase param
const querySvc = queriesSrc
  .replace(/import \{ createSupabaseServerClient \}[\s\S]*?from "\.\/types";\n\nasync function requireUser\(\)[\s\S]*?\n\}\n\n/, "")
  .replace(/export async function getBillingDashboard\(\)/, "export async function getBillingDashboard(supabase: import(\"@supabase/supabase-js\").SupabaseClient)")
  .replace(
    /export async function getInvoiceWorkspace\(\n  invoiceId: string\n\)/,
    "export async function getInvoiceWorkspace(supabase: import(\"@supabase/supabase-js\").SupabaseClient, invoiceId: string)"
  )
  .replace(
    /export async function getCampaignBillingLines\(\n  campaignId: string\n\)/,
    "export async function getCampaignBillingLines(supabase: import(\"@supabase/supabase-js\").SupabaseClient, campaignId: string)"
  )
  .replace(
    /export async function getCampaignBillingGroups\(\n  campaignId: string\n\)/,
    "export async function getCampaignBillingGroups(supabase: import(\"@supabase/supabase-js\").SupabaseClient, campaignId: string)"
  )
  .replace(
    /export async function getCampaignOperationalBillingDetail\(\n  campaignId: string\n\)/,
    "export async function getCampaignOperationalBillingDetail(supabase: import(\"@supabase/supabase-js\").SupabaseClient, campaignId: string)"
  )
  .replace(/const \{ supabase \} = await requireUser\(\);\n\n/g, "");

// Split queries: dashboard -> statement-service, rest -> billing-service queries part
const dashboardMatch = querySvc.match(/export async function getBillingDashboard[\s\S]*?(?=\nexport async function getInvoiceWorkspace)/);
const invoiceWsMatch = querySvc.match(/export async function getInvoiceWorkspace[\s\S]*?(?=\nexport async function getCampaignBillingLines)/);
const restMatch = querySvc.match(/export async function getCampaignBillingLines[\s\S]*$/);

fs.writeFileSync(
  path.join(outDir, "statement-service.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";\n\n${querySvc.split("export async function getBillingDashboard")[0]}\n${dashboardMatch[0].replace("export async function getBillingDashboard(supabase: import(\"@supabase/supabase-js\").SupabaseClient)", "export async function getBillingDashboard(supabase: SupabaseClient)")}`
);

fs.writeFileSync(
  path.join(outDir, "invoice-service-queries.ts"),
  `import type { SupabaseClient } from "@supabase/supabase-js";\n\n${invoiceWsMatch[0]}`
);

// Append getInvoiceWorkspace to invoice-service.ts
fs.appendFileSync(path.join(outDir, "invoice-service.ts"), "\n\n" + invoiceWsMatch[0].replace(/export async function getInvoiceWorkspace\(supabase: import\("@supabase\/supabase-js"\)\.SupabaseClient/, "export async function getInvoiceWorkspace(supabase: SupabaseClient"));

fs.writeFileSync(
  path.join(outDir, "billing-service.ts"),
  fs.readFileSync(path.join(outDir, "billing-service.ts"), "utf8") + "\n\n" + restMatch[0].replace(/export async function getCampaignBillingLines\(supabase: import\("@supabase\/supabase-js"\)\.SupabaseClient/g, "export async function getCampaignBillingLines(supabase: SupabaseClient").replace(/export async function getCampaignBillingGroups\(supabase: import\("@supabase\/supabase-js"\)\.SupabaseClient/g, "export async function getCampaignBillingGroups(supabase: SupabaseClient").replace(/export async function getCampaignOperationalBillingDetail\(supabase: import\("@supabase\/supabase-js"\)\.SupabaseClient/g, "export async function getCampaignOperationalBillingDetail(supabase: SupabaseClient")
);

// index.ts
fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `export type { BillingMutationResult } from "./billing-helpers";
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
`
);

// Thin actions.ts
const thinActions = `"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  approveLineForBilling,
  bulkApproveOperationalBilling,
  bulkMoveOperationalBilling,
  closeBillingLine,
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
import { getCampaignOperationalBillingDetail } from "@/lib/services/billing/billing-service";
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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
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
  if (result.ok && result.invoiceId) revalidateBilling({ invoiceId: result.invoiceId, campaignId: result.campaignId });
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
    const message = error instanceof Error ? error.message : "Failed to load drill-down.";
    return { ok: false as const, message };
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

// Thin queries.ts
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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
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

// Test file
fs.writeFileSync(
  path.join(outDir, "billing-service-layer.test.ts"),
  `import assert from "node:assert/strict";

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
`
);

console.log("Billing service layer built.");
