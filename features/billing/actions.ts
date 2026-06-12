"use server";

import { revalidatePath } from "next/cache";

import { FINANCIAL_APPROVAL_CHAIN } from "@/features/billing/constants";
import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOperationalPo } from "@/lib/finance/po/operational-budget";
import { governanceDb } from "@/lib/supabase/governance-client";
import { resolveClientBillingVatRate } from "@/lib/vat/queries";
import {
  fetchDeliverablesForInvoicing,
  insertPackageAssignmentLineItems,
  lineHasAssignmentDeliverables,
  lockDeliverablesOnInvoice,
  assertInvoiceHasBillableLineItems,
  regenerateInvoiceLineItems,
  resolveInvoiceDeliverableIds,
  prepareLinesForDeliverableInvoicing,
  validateDeliverablesForInvoice,
} from "@/lib/billing/invoice-from-deliverables";
import {
  fetchPostsForInvoicing,
  lockPostsOnInvoice,
  preparePostsForInvoiceValidation,
  validatePostsForInvoice,
} from "@/lib/billing/invoice-from-posts";
import {
  ensureBillableDeliverablesForLine,
  markDeliverablesReadyToInvoice,
  syncLineBillingFromDeliverables,
  unlockDeliverablesForInvoice,
} from "@/lib/billing/sync-deliverable-billing";
import { repairDesyncedUngeneratedInvoiceHeaders } from "@/lib/billing/repair-orphaned-invoice-state";
import { runPreInvoiceCreateRepairPipeline } from "@/lib/billing/repair-invoice-create-pipeline";
import { syncDeliverableCollectionsForInvoice } from "@/lib/billing/sync-deliverable-collections";
import {
  resolveOperationalInvoiceTargets,
  validateAppendableInvoice,
} from "@/lib/billing/resolve-operational-invoice";
import { invoiceUngenerateIneligibleReason } from "@/lib/billing/invoice-ungenerate-eligibility";
import { ensureInvoiceFinanceDocument } from "@/lib/finance/finance-document-registry";
import { blockInvoiceWithoutVendorIoMessage } from "@/lib/billing/line-invoice-eligibility";
import { resolveScopedInvoiceLineIds } from "@/lib/billing/invoice-validation-scope";
import {
  buildInvoiceValidationContext,
  invoicedRowAllowed,
  isInvoicedOperationalRow,
  parseInvoiceBillingMode,
} from "@/lib/billing/invoice-validation-context";
import {
  approveOperationalRows,
  markOperationalRowsReadyToInvoice,
  resolveBulkBillingTargets,
} from "@/lib/billing/sync-operational-row-billing";
import { commitInvoiceLifecycleMutation } from "@/lib/billing/invoice-lifecycle-commit";
import type { InvoiceLineItemOpSummary } from "@/lib/billing/invoice-lifecycle-debug";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";

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
import { requirePermission } from "@/lib/auth/permissions";
import { getCampaignOperationalBillingDetail } from "@/features/billing/queries";

export type BillingActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  invoiceId?: string;
  campaignId?: string;
};

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

function buildInvoiceCreateSuccessMessage(input: {
  invoiceMode: ReturnType<typeof parseInvoiceBillingMode>;
  documentNumber: string;
  invoicedRowCount: number;
  requestedLineIds: string[];
  touchedLineIds: string[];
}): string {
  const displayNumber = formatDocumentNumberForDisplay(input.documentNumber);
  const actionLabel = input.invoiceMode === "append" ? "Appended to" : "Created";
  const rowLabel = input.invoicedRowCount === 1 ? "row" : "rows";
  let message = `${actionLabel} invoice ${displayNumber} (${input.invoicedRowCount} ${rowLabel}).`;

  const touched = new Set(input.touchedLineIds);
  const skippedLineCount = input.requestedLineIds.filter((lineId) => !touched.has(lineId)).length;
  if (skippedLineCount > 0) {
    message += ` ${skippedLineCount} selected assignment${skippedLineCount === 1 ? "" : "s"} still ha${skippedLineCount === 1 ? "s" : "ve"} billable rows remaining.`;
  }

  return message;
}

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

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
  if (paths.campaignId) {
    revalidatePath(`/campaigns/${paths.campaignId}`);
  }
  if (paths.invoiceId) {
    revalidatePath(`/billing/invoices/${paths.invoiceId}`);
  }
}

async function rollbackNewInvoiceDraft(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  invoiceId: string
): Promise<void> {
  await unlockDeliverablesForInvoice(supabase, invoiceId);
  await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
  await supabase.from("invoices").delete().eq("id", invoiceId);
}

async function createFinancialApprovalChain(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  input: {
    entity_type: string;
    entity_id: string;
    title: string;
    description?: string;
    stages?: typeof FINANCIAL_APPROVAL_CHAIN;
  }
): Promise<string | null> {
  const stages = input.stages ?? FINANCIAL_APPROVAL_CHAIN;
  for (let i = 0; i < stages.length; i++) {
    const { error } = await supabase.from("financial_approval_requests").insert({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      approval_stage: stages[i],
      chain_order: i + 1,
      title: `${input.title} — ${stages[i]}`,
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

export async function approveLineForBillingAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = approveLineForBillingSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: line, error: fetchError } = await supabase
    .from("campaign_lines")
    .select("billing_status, document_number")
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id)
    .maybeSingle();

  if (fetchError || !line) {
    return { ok: false, message: fetchError?.message ?? "Line not found." };
  }

  if (line.billing_status !== "draft") {
    return { ok: false, message: "Only draft lines can be approved for billing." };
  }

  const { error } = await supabase
    .from("campaign_lines")
    .update({ billing_status: "approved" })
    .eq("id", parsed.data.line_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  const approvalError = await createFinancialApprovalChain(supabase, user.id, {
    entity_type: "campaign_line",
    entity_id: parsed.data.line_id,
    title: `Billing approval — ${line.document_number}`,
    description: "Campaign Manager approval for billing readiness",
    stages: ["campaign_manager"],
  });

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return {
    ok: true,
    message: approvalError
      ? "Line approved for billing. Approval workflow could not be recorded — apply billing migrations if needed."
      : "Line approved for billing.",
  };
}

export async function moveLineToBillingAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = moveLineToBillingSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const [{ data: line, error: fetchError }, { data: header, error: headerError }] =
    await Promise.all([
      supabase
        .from("campaign_lines")
        .select(
          "id, billing_status, document_number, po_amount, cost, revenue_before_vat, revenue, revenue_vat_percent, revenue_vat_amount, revenue_after_vat, revenue_vat_exempt, cost_before_vat, cost_vat_percent, cost_vat_amount, cost_after_vat, cost_vat_exempt, platform, campaign_header_id"
        )
        .eq("id", parsed.data.line_id)
        .eq("campaign_header_id", parsed.data.campaign_id)
        .maybeSingle(),
      supabase
        .from("campaign_headers")
        .select(
          "po_amount_campaign_currency, po_consumed_amount, po_remaining_amount, po_remaining_percent, po_status, po_expiry_date, po_override_approved"
        )
        .eq("id", parsed.data.campaign_id)
        .maybeSingle(),
    ]);

  if (fetchError || !line) {
    return { ok: false, message: fetchError?.message ?? "Line not found." };
  }

  if (headerError || !header) {
    return { ok: false, message: headerError?.message ?? "Campaign not found." };
  }

  if (!["approved", "draft"].includes(line.billing_status)) {
    return {
      ok: false,
      message: "Line must be approved before moving to billing.",
    };
  }

  const { data: siblingLines } = await supabase
    .from("campaign_lines")
    .select("po_amount, revenue_before_vat, revenue")
    .eq("campaign_header_id", parsed.data.campaign_id);

  const legacyBudget = (siblingLines ?? []).reduce(
    (sum, row) => sum + Number(row.po_amount ?? 0),
    0
  );
  const legacyConsumed = (siblingLines ?? []).reduce(
    (sum, row) =>
      sum + Number(row.revenue_before_vat ?? row.revenue ?? 0),
    0
  );

  const operationalPo = resolveOperationalPo({
    po_amount_campaign_currency: header.po_amount_campaign_currency,
    po_consumed_amount: header.po_consumed_amount,
    po_remaining_amount: header.po_remaining_amount,
    po_remaining_percent: header.po_remaining_percent,
    po_status: header.po_status,
    po_expiry_date: header.po_expiry_date,
    legacy_budget: legacyBudget,
    legacy_consumed: legacyConsumed,
  });

  if (
    operationalPo.po_exceeded &&
    !header.po_override_approved
  ) {
    return {
      ok: false,
      message:
        "Campaign PO exceeded. Finance override required before moving lines to billing.",
    };
  }

  if (
    !operationalPo.uses_governance &&
    Number(line.cost) > Number(line.po_amount) &&
    Number(line.po_amount) > 0
  ) {
    return {
      ok: false,
      message: "PO over-consumption detected. Finance review required before billing.",
    };
  }

  const { error } = await supabase
    .from("campaign_lines")
    .update({
      billing_status: "moved_to_billing",
      billing_moved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.line_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  const deliverableCheck = await ensureBillableDeliverablesForLine(supabase, {
    id: line.id,
    campaign_header_id: line.campaign_header_id,
    document_number: line.document_number,
    name: line.document_number,
    platform: line.platform,
    revenue: Number(line.revenue),
    revenue_before_vat: Number(line.revenue_before_vat ?? line.revenue),
    revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
    revenue_vat_amount: Number(line.revenue_vat_amount ?? 0),
    revenue_after_vat: Number(line.revenue_after_vat ?? line.revenue),
    revenue_vat_exempt: line.revenue_vat_exempt ?? false,
    cost: Number(line.cost),
    cost_before_vat: Number(line.cost_before_vat ?? line.cost),
    cost_vat_percent: Number(line.cost_vat_percent ?? 0),
    cost_vat_amount: Number(line.cost_vat_amount ?? 0),
    cost_after_vat: Number(line.cost_after_vat ?? line.cost),
    cost_vat_exempt: line.cost_vat_exempt ?? false,
    billing_status: "moved_to_billing",
  });
  if (!deliverableCheck.ok) {
    await supabase
      .from("campaign_lines")
      .update({ billing_status: line.billing_status })
      .eq("id", parsed.data.line_id);
    return { ok: false, message: deliverableCheck.message ?? "Deliverables required." };
  }
  await markDeliverablesReadyToInvoice(supabase, parsed.data.line_id);

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Line moved to billing queue." };
}

export async function bulkApproveOperationalBillingAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = bulkOperationalBillingSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid bulk approve request." };
  }

  const targets = resolveBulkBillingTargets(parsed.data);
  const { supabase } = await requireAuthUser();

  if (
    targets.lineIds.length === 0 &&
    targets.deliverableIds.length === 0 &&
    targets.postIds.length === 0
  ) {
    return { ok: false, message: "Select at least one row to approve." };
  }

  let approved = 0;
  let skipped = 0;

  if (targets.hasGranularSelection) {
    const { updated, error } = await approveOperationalRows(
      supabase,
      parsed.data.campaign_id,
      targets
    );
    if (error) {
      return { ok: false, message: error };
    }
    approved += updated;
  }

  for (const lineId of targets.lineIds) {
    const fd = new FormData();
    fd.set("line_id", lineId);
    fd.set("campaign_id", parsed.data.campaign_id);
    const result = await approveLineForBillingAction({ ok: false }, fd);
    if (result.ok) approved += 1;
    else skipped += 1;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[bulk-billing] approve", {
      approved,
      skipped,
      granular: targets.hasGranularSelection,
      lineIds: targets.lineIds,
      deliverableIds: targets.deliverableIds,
      postIds: targets.postIds,
    });
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return {
    ok: approved > 0,
    message:
      approved > 0
        ? `Approved ${approved} row${approved === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}.`
        : "No rows were approved.",
  };
}

export async function bulkMoveOperationalBillingAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = bulkOperationalBillingSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid bulk move request." };
  }

  const targets = resolveBulkBillingTargets(parsed.data);
  const { supabase } = await requireAuthUser();

  if (
    targets.lineIds.length === 0 &&
    targets.deliverableIds.length === 0 &&
    targets.postIds.length === 0
  ) {
    return { ok: false, message: "Select at least one row to move." };
  }

  let moved = 0;
  let skipped = 0;

  if (targets.hasGranularSelection) {
    const { updated, error } = await markOperationalRowsReadyToInvoice(
      supabase,
      parsed.data.campaign_id,
      targets
    );
    if (error) {
      return { ok: false, message: error };
    }
    moved += updated;
  }

  for (const lineId of targets.lineIds) {
    const fd = new FormData();
    fd.set("line_id", lineId);
    fd.set("campaign_id", parsed.data.campaign_id);
    const result = await moveLineToBillingAction({ ok: false }, fd);
    if (result.ok) moved += 1;
    else skipped += 1;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[bulk-billing] move to billing", {
      moved,
      skipped,
      granular: targets.hasGranularSelection,
      lineIds: targets.lineIds,
      deliverableIds: targets.deliverableIds,
      postIds: targets.postIds,
    });
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return {
    ok: moved > 0,
    message:
      moved > 0
        ? `Moved ${moved} row${moved === 1 ? "" : "s"} to billing${skipped ? ` (${skipped} skipped)` : ""}.`
        : "No rows were moved to billing.",
  };
}

export async function createInvoiceFromLinesAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = createInvoiceFromLinesSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const lineIds = (parsed.data.line_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const requestedDeliverableIds = (parsed.data.deliverable_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const requestedPostIds = (parsed.data.post_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const invoiceMode = parseInvoiceBillingMode(parsed.data.invoice_mode);
  const validationCtx = buildInvoiceValidationContext({
    mode: invoiceMode,
    targetInvoiceId: parsed.data.existing_invoice_id,
  });

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const permission = await requirePermission(supabase, "invoices.write");
  if ("error" in permission) {
    return { ok: false, message: permission.error };
  }
  if (!permission.roleSlug) {
    return {
      ok: false,
      message:
        "Your account has no role assigned. Ask an administrator to assign a finance or admin role before creating invoices.",
    };
  }

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select("id, client_id, currency_code, name")
    .eq("id", parsed.data.campaign_id)
    .maybeSingle();

  if (headerError || !header) {
    return { ok: false, message: headerError?.message ?? "Campaign not found." };
  }

  await runPreInvoiceCreateRepairPipeline(supabase, parsed.data.campaign_id);

  const { deliverableIds, postIds, error: resolveError } =
    await resolveOperationalInvoiceTargets(
      supabase,
      parsed.data.campaign_id,
      {
        lineIds,
        deliverableIds: requestedDeliverableIds,
        postIds: requestedPostIds,
      },
      validationCtx
    );

  if (resolveError) {
    return { ok: false, message: resolveError };
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[billing-invoice] invoice grouping batch", {
      campaignId: parsed.data.campaign_id,
      lineIds,
      deliverableIds: requestedDeliverableIds,
      postIds: requestedPostIds,
      mode: parsed.data.invoice_mode,
    });
    console.debug("[billing-invoice] selected operational row ids", {
      lineIds,
      deliverableIds,
      postIds,
      mode: parsed.data.invoice_mode,
    });
  }

  const usePostInvoicePath = requestedPostIds.length > 0 || postIds.length > 0;

  const deliverableIdsToFetch = [
    ...new Set([...requestedDeliverableIds, ...deliverableIds]),
  ];

  const { deliverables, error: deliverablesError } =
    await fetchDeliverablesForInvoicing(
      supabase,
      parsed.data.campaign_id,
      deliverableIdsToFetch
    );

  if (deliverablesError) {
    return { ok: false, message: deliverablesError };
  }

  const postIdsToFetch = usePostInvoicePath
    ? [...new Set([...requestedPostIds, ...postIds])]
    : [];

  const { posts, error: postsError } = usePostInvoicePath
    ? await fetchPostsForInvoicing(supabase, parsed.data.campaign_id, postIdsToFetch)
    : { posts: [], error: undefined };

  if (postsError) {
    return { ok: false, message: postsError };
  }

  await prepareLinesForDeliverableInvoicing(supabase, deliverables);

  const deliverableRegenerateScope =
    !usePostInvoicePath &&
    deliverables.length > 0 &&
    deliverables.every(
      (d) =>
        Boolean(d.locked_at) ||
        Boolean(d.invoice_line_item_id) ||
        Number(d.remaining_amount ?? 0) <= 0
    );
  const postRegenerateScope =
    usePostInvoicePath &&
    posts.length > 0 &&
    posts.every(
      (p) => invoicedRowAllowed(p, validationCtx) && isInvoicedOperationalRow(p)
    );

  if (lineIds.length > 0 || deliverableIds.length > 0 || postIds.length > 0) {
    let scopedLineIds: string[] = [];
    try {
      scopedLineIds = await resolveScopedInvoiceLineIds(supabase, {
        requestedLineIds: lineIds,
        resolvedDeliverableIds: deliverableIds,
        resolvedPostIds: postIds,
        deliverables,
      });
    } catch (scopeError) {
      return {
        ok: false,
        message: scopeError instanceof Error ? scopeError.message : "Invoice scope resolution failed.",
      };
    }

    if (scopedLineIds.length > 0 || deliverableIds.length > 0 || postIds.length > 0) {
      const ioCoverageMode =
        deliverableRegenerateScope || postRegenerateScope
          ? ("regenerate" as const)
          : ("generate" as const);

      let appendInvoiceLines:
        | import("@/features/billing/types").InvoiceWorkspace["lines"]
        | undefined;
      if (invoiceMode === "append" && validationCtx.targetInvoiceId) {
        const { getInvoiceLines } = await import("@/lib/finance/invoice-line-registry");
        const appendLinesResult = await getInvoiceLines(
          supabase,
          validationCtx.targetInvoiceId
        );
        if (!appendLinesResult.error) {
          appendInvoiceLines = appendLinesResult.lines;
        }
      }

      const { analyzeCreateInvoiceCoverage } = await import(
        "@/lib/operations/io-coverage-server"
      );
      const coverage = await analyzeCreateInvoiceCoverage(supabase, {
        campaignId: parsed.data.campaign_id,
        lineIds: scopedLineIds,
        deliverableIds,
        mode: ioCoverageMode,
        appendInvoiceLines,
      });

      if (coverage.case === "blocked") {
        const blockedLine = coverage.lines.find((l) => l.category === "needs_io");
        return {
          ok: false,
          message: blockedLine
            ? `${coverage.block_message ?? blockInvoiceWithoutVendorIoMessage()} (${blockedLine.line_name}).`
            : (coverage.block_message ?? blockInvoiceWithoutVendorIoMessage()),
        };
      }

      if (coverage.revised_line_ids.length > 0) {
        const { reviseVendorIoBatch } = await import("@/lib/io/revise-vendor-io-batch");
        const reviseResult = await reviseVendorIoBatch(supabase, {
          campaignId: parsed.data.campaign_id,
          lineIds: coverage.revised_line_ids,
          reason: "Invoice commercial correction before billing",
          userId: user.id,
        });
        if (!reviseResult.ok) {
          return { ok: false, message: reviseResult.error ?? "Vendor IO revision failed." };
        }
      }
    }
  }

  const deliverablesToLock = usePostInvoicePath
    ? deliverables.filter(
        (row) =>
          !posts.some((post) => post.assignment_deliverable_id === row.id)
      )
    : deliverables;

  let postsForInvoice = posts;

  if (usePostInvoicePath) {
    const postIdsRequested = requestedPostIds.length > 0 || postIds.length > 0;
    if (postIdsRequested && posts.length === 0) {
      return {
        ok: false,
        message:
          "Selected post rows could not be loaded for invoicing. Refresh the campaign and try again.",
      };
    }

    const preparedPosts = await preparePostsForInvoiceValidation(supabase, posts);
    postsForInvoice = preparedPosts.posts;

    const postValidationError = validatePostsForInvoice(
      postsForInvoice,
      validationCtx,
      preparedPosts.activeLineItemIds
    );
    if (postValidationError) {
      return { ok: false, message: postValidationError };
    }
  } else {
    if (
      requestedDeliverableIds.length === 0 &&
      requestedPostIds.length === 0 &&
      lineIds.length === 0
    ) {
      return { ok: false, message: "No billable deliverables selected." };
    }

    const validationError = validateDeliverablesForInvoice(deliverablesToLock, validationCtx);
    if (validationError) {
      return { ok: false, message: validationError };
    }
  }

  let invoiceId: string;
  let invoiceDocumentNumber: string;

  const { countryCode, vatRate } = await resolveClientBillingVatRate(
    supabase,
    header.client_id
  );

  if (invoiceMode === "append") {
    const existingId = parsed.data.existing_invoice_id?.trim();
    if (!existingId) {
      return { ok: false, message: "Select an invoice to append to." };
    }

    const appendCheck = await validateAppendableInvoice(supabase, existingId, {
      campaignId: header.id,
      clientId: header.client_id,
      currency: header.currency_code,
    });

    if (!appendCheck.ok) {
      return { ok: false, message: appendCheck.error };
    }

    if (appendCheck.invoice.regeneration_status === "pending_regeneration") {
      return {
        ok: false,
        message:
          "This invoice is pending regeneration. Use Regenerate invoice (not append) after commercial corrections.",
      };
    }

    invoiceId = appendCheck.invoice.id;
    invoiceDocumentNumber = appendCheck.invoice.document_number;

    if (process.env.NODE_ENV === "development") {
      console.debug("[billing-invoice] append action", { invoiceId, postIds, deliverableIds });
    }
  } else {
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        client_id: header.client_id,
        campaign_header_id: header.id,
        status: "draft",
        due_date: parsed.data.due_date,
        currency: header.currency_code,
        notes: emptyToNull(parsed.data.notes),
        billing_country_code: countryCode,
        created_by: user.id,
      })
      .select("id, document_number")
      .single();

    if (invoiceError || !invoice) {
      return { ok: false, message: invoiceError?.message ?? "Invoice creation failed." };
    }

    invoiceId = invoice.id;
    invoiceDocumentNumber = invoice.document_number;

    const approvalError = await createFinancialApprovalChain(supabase, user.id, {
      entity_type: "invoice",
      entity_id: invoiceId,
      title: `Invoice ${invoiceDocumentNumber}`,
      description: `Finance approval for ${header.name}`,
      stages: ["finance", "cfo_admin"],
    });

    if (approvalError && process.env.NODE_ENV === "development") {
      console.debug("[billing-invoice] approval chain skipped", approvalError);
    }
  }

  const touchedLineIds = [
    ...new Set([
      ...postsForInvoice.map((post) => post.campaign_line_id),
      ...deliverablesToLock.map((row) => row.campaign_line_id),
      ...lineIds,
    ]),
  ].filter(Boolean);

  const mergedLineItemOps: InvoiceLineItemOpSummary = { updated: [], created: [] };

  if (usePostInvoicePath && postsForInvoice.length > 0) {
    const postLockResult = await lockPostsOnInvoice(
      supabase,
      invoiceId,
      header.id,
      postsForInvoice,
      {
        defaultVatRate: vatRate,
        updateExistingOnTargetInvoice: invoiceMode === "append",
        forRegeneration: deliverableRegenerateScope || postRegenerateScope,
      }
    );
    if (postLockResult.lineItemOps) {
      mergedLineItemOps.updated.push(...postLockResult.lineItemOps.updated);
      mergedLineItemOps.created.push(...postLockResult.lineItemOps.created);
    }
    if (postLockResult.error) {
      if (invoiceMode === "new") {
        await rollbackNewInvoiceDraft(supabase, invoiceId);
      }
      return { ok: false, message: postLockResult.error };
    }
  }

  if (deliverablesToLock.length > 0) {
    const lockResult = await lockDeliverablesOnInvoice(
      supabase,
      invoiceId,
      header.id,
      deliverablesToLock,
      {
        defaultVatRate: vatRate,
        updateExistingOnTargetInvoice: invoiceMode === "append",
      }
    );

    if (lockResult.lineItemOps) {
      mergedLineItemOps.updated.push(...lockResult.lineItemOps.updated);
      mergedLineItemOps.created.push(...lockResult.lineItemOps.created);
    }
    if (lockResult.error) {
      if (invoiceMode === "new") {
        await rollbackNewInvoiceDraft(supabase, invoiceId);
      }
      return { ok: false, message: lockResult.error };
    }
  }

  const insertedPostRows = usePostInvoicePath && postsForInvoice.length > 0;
  const insertedDeliverableRows = deliverablesToLock.length > 0;
  const willInsertPackageLines = deliverablesToLock.length === 0 && posts.length === 0 && lineIds.length > 0;

  if (willInsertPackageLines) {
    const hasDeliverableBreakdown = await lineHasAssignmentDeliverables(supabase, lineIds);
    if (hasDeliverableBreakdown) {
      if (invoiceMode === "new") {
        await rollbackNewInvoiceDraft(supabase, invoiceId);
      }
      return {
        ok: false,
        message:
          "No billable deliverables remain on this assignment. Refresh the page — orphaned invoice state was reset if needed.",
      };
    }

    const packageLines = await insertPackageAssignmentLineItems(
      supabase,
      invoiceId,
      header.id,
      lineIds,
      {
        defaultVatRate: vatRate,
        forRegeneration: deliverableRegenerateScope || postRegenerateScope,
      }
    );
    if (packageLines.error) {
      if (invoiceMode === "new") {
        await rollbackNewInvoiceDraft(supabase, invoiceId);
      }
      return { ok: false, message: packageLines.error };
    }
    if (packageLines.inserted === 0) {
      if (invoiceMode === "new") {
        await rollbackNewInvoiceDraft(supabase, invoiceId);
      }
      return { ok: false, message: "No billable assignment lines could be invoiced." };
    }
  }

  if (!insertedPostRows && !insertedDeliverableRows && !willInsertPackageLines) {
    if (invoiceMode === "new") {
      await rollbackNewInvoiceDraft(supabase, invoiceId);
    }
    return { ok: false, message: "No billable deliverables selected." };
  }

  const billableCheck = await assertInvoiceHasBillableLineItems(supabase, invoiceId);
  if (billableCheck.error) {
    if (invoiceMode === "new") {
      await rollbackNewInvoiceDraft(supabase, invoiceId);
    }
    return { ok: false, message: billableCheck.error };
  }

  if (invoiceMode === "append") {
    const expectedDeliverableIds = deliverablesToLock.map((row) => row.id);
    if (expectedDeliverableIds.length > 0) {
      const { data: linkedItems, error: verifyError } = await supabase
        .from("invoice_line_items")
        .select("assignment_deliverable_id")
        .eq("invoice_id", invoiceId)
        .in("assignment_deliverable_id", expectedDeliverableIds);

      if (verifyError) {
        return { ok: false, message: verifyError.message };
      }

      const linkedCount = new Set(
        (linkedItems ?? []).map(
          (row) => (row as { assignment_deliverable_id: string }).assignment_deliverable_id
        )
      ).size;

      if (linkedCount < expectedDeliverableIds.length) {
        return {
          ok: false,
          message:
            "Append did not create invoice line items for all selected deliverables. Refresh and try again.",
        };
      }
    } else if (willInsertPackageLines && lineIds.length > 0) {
      const { count, error: verifyError } = await supabase
        .from("invoice_line_items")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoiceId)
        .in("campaign_line_id", lineIds);

      if (verifyError) {
        return { ok: false, message: verifyError.message };
      }

      if (!count || count === 0) {
        return {
          ok: false,
          message:
            "Append did not create invoice line items for the selected assignment. Refresh and try again.",
        };
      }
    }
  }

  const commitResult = await commitInvoiceLifecycleMutation(supabase, {
    mutation: invoiceMode === "append" ? "append" : "create",
    invoiceId,
    campaignId: parsed.data.campaign_id,
    invoiceDocumentNumber,
    actorId: user.id,
    touchedLineIds,
    execute: async () => ({ touchedLineIds }),
  });

  if (commitResult.error) {
    if (invoiceMode === "new") {
      await rollbackNewInvoiceDraft(supabase, invoiceId);
    }
    return { ok: false, message: commitResult.error };
  }

  revalidateBilling({
    campaignId: parsed.data.campaign_id,
    invoiceId,
  });

  if (process.env.NODE_ENV === "development") {
    console.debug("[queue-refresh] invoice created — billing paths revalidated", {
      campaignId: parsed.data.campaign_id,
      invoiceId,
      deliverableCount: deliverables.length,
    });
  }

  const invoicedRowCount = usePostInvoicePath
    ? postsForInvoice.length + deliverablesToLock.length
    : deliverablesToLock.length;

  return {
    ok: true,
    message: buildInvoiceCreateSuccessMessage({
      invoiceMode,
      documentNumber: invoiceDocumentNumber,
      invoicedRowCount,
      requestedLineIds: lineIds,
      touchedLineIds: commitResult.lineIds ?? touchedLineIds,
    }),
    invoiceId,
    campaignId: parsed.data.campaign_id,
  };
}

export async function recordCollectionPaymentAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = recordCollectionPaymentSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("id, client_id, campaign_header_id, document_number, currency")
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, message: invError?.message ?? "Invoice not found." };
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoice.id,
    client_id: invoice.client_id,
    amount: parsed.data.amount,
    currency: invoice.currency,
    status: "completed",
    payment_method: parsed.data.payment_method,
    reference_number: emptyToNull(parsed.data.reference_number),
    notes: emptyToNull(parsed.data.notes),
    paid_at: new Date().toISOString(),
    recorded_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await syncDeliverableCollectionsForInvoice(supabase, invoice.id);

  revalidateBilling({
    invoiceId: invoice.id,
    campaignId: invoice.campaign_header_id ?? undefined,
  });

  return {
    ok: true,
    message: `Payment recorded for ${invoice.document_number}.`,
  };
}

export async function recordVendorPaymentAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = recordVendorPaymentSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: assignment, error: assignError } = await supabase
    .from("campaign_influencers")
    .select("id, agreed_fee, currency, campaign_header_id")
    .eq("id", parsed.data.assignment_id)
    .maybeSingle();

  if (assignError || !assignment) {
    return { ok: false, message: assignError?.message ?? "Assignment not found." };
  }

  const { data: batch, error: batchError } = await supabase
    .from("vendor_payment_batches")
    .insert({
      name: parsed.data.batch_name,
      status: "completed",
      total_amount: parsed.data.amount || Number(assignment.agreed_fee),
      currency: assignment.currency,
      notes: emptyToNull(parsed.data.notes),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { ok: false, message: batchError?.message ?? "Batch creation failed." };
  }

  const { error: updateError } = await supabase
    .from("campaign_influencers")
    .update({
      vendor_payment_status: "paid",
      vendor_paid_at: new Date().toISOString(),
      payment_batch_id: batch.id,
    })
    .eq("id", parsed.data.assignment_id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Vendor payment recorded in batch." };
}

export async function decideFinancialApprovalAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = decideFinancialApprovalSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { error } = await supabase
    .from("financial_approval_requests")
    .update({
      status: parsed.data.decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: emptyToNull(parsed.data.decision_notes),
    })
    .eq("id", parsed.data.approval_id)
    .in("status", ["pending", "in_review"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/billing");
  return { ok: true, message: `Approval ${parsed.data.decision}.` };
}

export async function requestFinanceOverrideAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = requestFinanceOverrideSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const approvalError = await createFinancialApprovalChain(supabase, user.id, {
    entity_type: "campaign_line_override",
    entity_id: parsed.data.line_id,
    title: "Finance override request",
    description: parsed.data.reason,
    stages: ["finance", "cfo_admin"],
  });

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return {
    ok: true,
    message: approvalError
      ? "Finance override request submitted. Approval workflow could not be recorded."
      : "Finance override request submitted.",
  };
}

export async function grantFinanceOverrideAction(
  approvalId: string,
  lineId: string,
  hours: number
): Promise<BillingActionState> {
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const until = new Date(Date.now() + hours * 3600000).toISOString();

  const { error } = await supabase
    .from("campaign_lines")
    .update({ finance_override_until: until })
    .eq("id", lineId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await supabase
    .from("financial_approval_requests")
    .update({
      status: "approved",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approvalId);

  revalidatePath("/billing");
  return { ok: true, message: "Finance override granted." };
}

export async function closeBillingLineAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = closeBillingLineSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { error } = await supabase
    .from("campaign_lines")
    .update(lineBillingPatch("closed"))
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id)
    .in("billing_status", ["paid", "partially_paid"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Billing line closed." };
}

export async function ungenerateInvoiceAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = ungenerateInvoiceSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Reason is required (min 3 characters)." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const auth = await requirePermission(supabase, "finance.regenerate");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, total, subtotal, tax_amount, version_number, regeneration_status, status, is_operational_locked"
    )
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, message: invError?.message ?? "Invoice not found." };
  }

  const ineligible = invoiceUngenerateIneligibleReason({
    status: invoice.status as string,
    regeneration_status: invoice.regeneration_status,
    is_operational_locked: invoice.is_operational_locked,
  });
  if (ineligible) {
    return { ok: false, message: ineligible };
  }

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoice.id)
    .order("sort_order");

  await governanceDb(supabase).from("invoice_versions").insert({
    invoice_id: invoice.id,
    version_number: invoice.version_number ?? 1,
    snapshot: invoice as Record<string, unknown>,
    line_items_snapshot: lineItems ?? [],
    total: Number(invoice.total ?? 0),
    subtotal: Number(invoice.subtotal ?? 0),
    tax_amount: Number(invoice.tax_amount ?? 0),
    regeneration_reason: parsed.data.reason,
    regenerated_by: auth.userId,
  });

  const commitResult = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "ungenerate",
    invoiceId: invoice.id,
    campaignId: invoice.campaign_header_id ?? undefined,
    invoiceDocumentNumber: invoice.document_number,
    actorId: auth.userId,
    preserveLineItems: false,
    unlockMode: "unpost",
    execute: async () => {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          regeneration_status: "pending_regeneration",
          status: "draft",
          is_operational_locked: false,
          ungenerated_at: new Date().toISOString(),
          ungenerated_by: auth.userId,
          ungenerate_reason: parsed.data.reason,
        } as never)
        .eq("id", invoice.id);

      if (updateError) {
        return { error: updateError.message };
      }
      return {};
    },
  });

  if (commitResult.error) {
    return { ok: false, message: commitResult.error };
  }

  if (invoice.campaign_header_id) {
    await runPreInvoiceCreateRepairPipeline(supabase, invoice.campaign_header_id);
    await repairDesyncedUngeneratedInvoiceHeaders(supabase, invoice.campaign_header_id);
  }

  await governanceDb(supabase).from("finance_override_logs").insert({
    entity_type: "invoice",
    entity_id: invoice.id,
    override_type: "ungenerate",
    reason: parsed.data.reason,
    granted_by: auth.userId,
    granted_until: new Date(Date.now() + 72 * 3600000).toISOString(),
  });

  revalidateBilling({
    invoiceId: invoice.id,
    campaignId: invoice.campaign_header_id ?? undefined,
  });

  return {
    ok: true,
    message: `Invoice ${invoice.document_number} un-generated. Same number reserved — status: Pending Regeneration.`,
  };
}

export async function regenerateInvoiceAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = regenerateInvoiceSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Reason is required (min 3 characters)." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const auth = await requirePermission(supabase, "finance.regenerate");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, version_number, regeneration_status"
    )
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, message: invError?.message ?? "Invoice not found." };
  }

  if (invoice.regeneration_status !== "pending_regeneration") {
    return {
      ok: false,
      message: "Only invoices pending regeneration can be regenerated.",
    };
  }

  if (invoice.campaign_header_id) {
    await runPreInvoiceCreateRepairPipeline(supabase, invoice.campaign_header_id);
  }

  const { getInvoiceLines } = await import("@/lib/finance/invoice-line-registry");
  const invoiceLinesResult = await getInvoiceLines(supabase, invoice.id);
  if (invoiceLinesResult.error) {
    return { ok: false, message: invoiceLinesResult.error };
  }
  const { resolveInvoiceRegenerationScope } = await import(
    "@/lib/billing/invoice-regeneration-scope"
  );
  const regenScope = await resolveInvoiceRegenerationScope(supabase, {
    invoiceId: invoice.id,
    campaignHeaderId: invoice.campaign_header_id,
  });

  const requestedLineIds = (parsed.data.line_ids ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const requestedDeliverableIds = (parsed.data.deliverable_ids ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  let scopedLineIds = regenScope.lineIds;
  let scopedDeliverableIds = regenScope.deliverableIds;

  if (
    (requestedLineIds.length > 0 || requestedDeliverableIds.length > 0) &&
    invoice.campaign_header_id
  ) {
    const { resolveUserRegenerationSelection } = await import(
      "@/lib/billing/invoice-regeneration-selection"
    );
    const userScope = await resolveUserRegenerationSelection(
      supabase,
      invoice.campaign_header_id,
      {
        lineIds: requestedLineIds,
        deliverableIds: requestedDeliverableIds,
      }
    );
    if (userScope.error) {
      return { ok: false, message: userScope.error };
    }
    if (userScope.lineIds.length === 0 && userScope.deliverableIds.length === 0) {
      return {
        ok: false,
        message: "Select at least one assignment to regenerate on this invoice.",
      };
    }
    scopedLineIds = userScope.lineIds;
    scopedDeliverableIds = userScope.deliverableIds;
  }

  const { filterIoGatedCampaignLineIds } = await import(
    "@/lib/billing/invoice-regeneration-selection"
  );
  scopedLineIds = await filterIoGatedCampaignLineIds(supabase, scopedLineIds);

  if (scopedLineIds.length === 0 && scopedDeliverableIds.length === 0) {
    return {
      ok: false,
      message:
        "No assignments in regeneration scope. Select the assignments to rebuild, then try again.",
    };
  }

  const baselineInvoiceLines =
    regenScope.baselineLines.length > 0
      ? regenScope.baselineLines
      : invoiceLinesResult.lines;

  const { clearStaleInvoiceLinksOutsideScope } = await import(
    "@/lib/billing/invoice-regeneration-selection"
  );
  await clearStaleInvoiceLinksOutsideScope(supabase, invoice.id, scopedLineIds);

  if (scopedLineIds.length > 0 && invoice.campaign_header_id) {
    const { analyzeInvoiceRegenerationCoverage } = await import(
      "@/lib/operations/io-coverage-server"
    );
    const coverage = await analyzeInvoiceRegenerationCoverage(supabase, {
      invoiceLines: baselineInvoiceLines.map((row) => ({
        id: row.id,
        campaign_line_id: row.campaign_line_id,
        assignment_deliverable_id: row.assignment_deliverable_id,
        description: row.description,
        quantity: row.quantity,
        unit_price: row.unit_price,
        line_total: row.line_total,
        revenue_before_vat: row.revenue_before_vat,
        revenue_vat_percent: row.revenue_vat_percent,
        revenue_vat_amount: row.revenue_vat_amount,
        revenue_vat_exempt: row.revenue_vat_exempt,
        line_document_number: row.line_document_number,
        deliverable_label: row.deliverable_label,
      })),
      scope: {
        lineIds: scopedLineIds,
        deliverableIds:
          scopedDeliverableIds.length > 0 ? scopedDeliverableIds : undefined,
      },
      mode: "regenerate",
    });

    if (coverage.case === "blocked") {
      return {
        ok: false,
        message:
          coverage.block_message ??
          "Generate Vendor IO for new assignments or deliverables before regenerating.",
      };
    }

    const { findVendorIoAmountDriftForCampaign } = await import(
      "@/lib/io/vendor-io-amount-drift"
    );
    const vioDriftLineIds = (
      await findVendorIoAmountDriftForCampaign(
        supabase,
        invoice.campaign_header_id,
        coverage.revised_line_ids
      )
    ).map((row) => row.line_id);

    if (vioDriftLineIds.length > 0) {
      const { reviseVendorIoBatch } = await import("@/lib/io/revise-vendor-io-batch");
      const reviseResult = await reviseVendorIoBatch(supabase, {
        campaignId: invoice.campaign_header_id,
        lineIds: vioDriftLineIds,
        reason: `Invoice regeneration: ${parsed.data.reason}`,
        userId: auth.userId,
      });
      if (!reviseResult.ok) {
        return { ok: false, message: reviseResult.error ?? "Vendor IO revision failed." };
      }
    }
  }

  const { vatRate } = await resolveClientBillingVatRate(supabase, invoice.client_id);

  const regenerateTouchedLineIds = [...new Set(scopedLineIds)];

  const newVersion = (invoice.version_number ?? 1) + 1;

  const commitResult = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "regenerate",
    invoiceId: invoice.id,
    campaignId: invoice.campaign_header_id ?? undefined,
    invoiceDocumentNumber: invoice.document_number,
    actorId: auth.userId,
    touchedLineIds: regenerateTouchedLineIds,
    execute: async () => {
      const regenResult = await regenerateInvoiceLineItems(
        supabase,
        invoice.id,
        invoice.campaign_header_id!,
        {
          defaultVatRate: vatRate,
          lineIds: scopedLineIds,
          deliverableIds: scopedDeliverableIds,
          postIds: regenScope.postIds,
        }
      );

      if (regenResult.error) {
        return { error: regenResult.error };
      }

      const billableCheck = await assertInvoiceHasBillableLineItems(supabase, invoice.id);
      if (billableCheck.error) {
        return { error: billableCheck.error };
      }

      const { count: lineItemCount, error: lineItemCountError } = await supabase
        .from("invoice_line_items")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoice.id);

      if (lineItemCountError) {
        return { error: lineItemCountError.message };
      }

      if (!lineItemCount || lineItemCount === 0) {
        return {
          error:
            "Regeneration did not rebuild invoice line items. Save assignment changes, refresh, and try again.",
        };
      }

      const { error: invoiceUpdateError } = await supabase
        .from("invoices")
        .update({
          version_number: newVersion,
          regeneration_status: "active",
          status: "draft",
        } as never)
        .eq("id", invoice.id);

      if (invoiceUpdateError) {
        return { error: invoiceUpdateError.message };
      }

      return {
        touchedLineIds: [
          ...new Set([...regenerateTouchedLineIds, ...regenResult.touchedLineIds]),
        ],
        lineItemOps: regenResult.lineItemOps ?? {
          updated: baselineInvoiceLines.map((item) => item.id).filter(Boolean),
          created: [],
        },
      };
    },
  });

  if (commitResult.error) {
    return { ok: false, message: commitResult.error };
  }

  const { data: refreshedInvoice, error: refreshError } = await supabase
    .from("invoices")
    .select("subtotal, tax_amount, total")
    .eq("id", invoice.id)
    .single();

  if (refreshError || !refreshedInvoice) {
    return { ok: false, message: refreshError?.message ?? "Failed to refresh invoice totals." };
  }

  const subtotal = Number(refreshedInvoice.subtotal);
  const taxAmount = Number(refreshedInvoice.tax_amount);
  const total = Number(refreshedInvoice.total);
  const refreshedLinesResult = await getInvoiceLines(supabase, invoice.id);
  if (refreshedLinesResult.error) {
    return { ok: false, message: refreshedLinesResult.error };
  }
  const lines = refreshedLinesResult.lines;

  await governanceDb(supabase).from("invoice_versions").insert({
    invoice_id: invoice.id,
    version_number: newVersion,
    snapshot: { total, subtotal, tax_amount: taxAmount },
    line_items_snapshot: lines,
    total,
    subtotal,
    tax_amount: taxAmount,
    regeneration_reason: parsed.data.reason,
    regenerated_by: auth.userId,
  });

  revalidateBilling({
    invoiceId: invoice.id,
    campaignId: invoice.campaign_header_id ?? undefined,
  });

  return {
    ok: true,
    message: `Invoice ${invoice.document_number} regenerated (v${newVersion}). Same invoice number preserved.`,
  };
}

export async function loadCampaignBillingDetailAction(campaignId: string) {
  try {
    const detail = await getCampaignOperationalBillingDetail(campaignId);
    if (process.env.NODE_ENV === "development" && detail) {
      console.debug("[billing-drilldown] expansion loaded", {
        campaignId,
        rows: detail.operational_rows.length,
      });
    }
    return { ok: true as const, detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load drill-down.";
    return { ok: false as const, message };
  }
}

/** Revalidate billing routes and return fresh campaign operational detail. */
export async function refreshBillingAfterInvoiceAction(campaignId: string) {
  const { supabase, error: authError } = await requireAuthUser();
  if (!authError && supabase) {
    const { runPreInvoiceCreateRepairPipeline } = await import(
      "@/lib/billing/repair-invoice-create-pipeline"
    );
    await runPreInvoiceCreateRepairPipeline(supabase, campaignId);
  }
  revalidateBilling({ campaignId });
  return loadCampaignBillingDetailAction(campaignId);
}
