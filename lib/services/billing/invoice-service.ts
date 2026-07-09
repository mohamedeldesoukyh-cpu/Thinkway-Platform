import type { SupabaseClient } from "@supabase/supabase-js";

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
import { requirePermission } from "@/lib/auth/permissions-server";
import type { z } from "zod";
import type {
  createInvoiceFromLinesSchema,
  regenerateInvoiceSchema,
  ungenerateInvoiceSchema,
} from "@/lib/domains/billing/schemas";
import type { FinancialApprovalRow, InvoiceWorkspace } from "@/lib/domains/billing/types";
import {
  buildInvoiceCreateSuccessMessage,
  emptyToNull,
  rollbackNewInvoiceDraft,
  type BillingMutationResult,
} from "./billing-helpers";
import { insertFinancialApprovalChain } from "./repositories/billing-repository";

export async function createInvoiceFromLines(supabase: SupabaseClient, userId: string, input: z.infer<typeof createInvoiceFromLinesSchema>): Promise<BillingMutationResult> {const lineIds = (input.line_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const requestedDeliverableIds = (input.deliverable_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const requestedPostIds = (input.post_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const invoiceMode = parseInvoiceBillingMode(input.invoice_mode);
  const validationCtx = buildInvoiceValidationContext({
    mode: invoiceMode,
    targetInvoiceId: input.existing_invoice_id,
  });const permission = await requirePermission(supabase, "invoices.write");
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
    .eq("id", input.campaign_id)
    .maybeSingle();

  if (headerError || !header) {
    return { ok: false, message: headerError?.message ?? "Campaign not found." };
  }

  await runPreInvoiceCreateRepairPipeline(supabase, input.campaign_id);

  const { deliverableIds, postIds, error: resolveError } =
    await resolveOperationalInvoiceTargets(
      supabase,
      input.campaign_id,
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
      campaignId: input.campaign_id,
      lineIds,
      deliverableIds: requestedDeliverableIds,
      postIds: requestedPostIds,
      mode: input.invoice_mode,
    });
    console.debug("[billing-invoice] selected operational row ids", {
      lineIds,
      deliverableIds,
      postIds,
      mode: input.invoice_mode,
    });
  }

  const usePostInvoicePath = requestedPostIds.length > 0 || postIds.length > 0;

  const deliverableIdsToFetch = [
    ...new Set([...requestedDeliverableIds, ...deliverableIds]),
  ];

  const { deliverables, error: deliverablesError } =
    await fetchDeliverablesForInvoicing(
      supabase,
      input.campaign_id,
      deliverableIdsToFetch
    );

  if (deliverablesError) {
    return { ok: false, message: deliverablesError };
  }

  const postIdsToFetch = usePostInvoicePath
    ? [...new Set([...requestedPostIds, ...postIds])]
    : [];

  const { posts, error: postsError } = usePostInvoicePath
    ? await fetchPostsForInvoicing(supabase, input.campaign_id, postIdsToFetch)
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
        | import("@/lib/domains/billing/types").InvoiceWorkspace["lines"]
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
        campaignId: input.campaign_id,
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
          campaignId: input.campaign_id,
          lineIds: coverage.revised_line_ids,
          reason: "Invoice commercial correction before billing",
          userId: userId,
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
    const existingId = input.existing_invoice_id?.trim();
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
        due_date: input.due_date,
        currency: header.currency_code,
        notes: emptyToNull(input.notes),
        billing_country_code: countryCode,
        created_by: userId,
      })
      .select("id, document_number")
      .single();

    if (invoiceError || !invoice) {
      return { ok: false, message: invoiceError?.message ?? "Invoice creation failed." };
    }

    invoiceId = invoice.id;
    invoiceDocumentNumber = invoice.document_number;

    const approvalError = await insertFinancialApprovalChain(supabase, userId, {
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
    campaignId: input.campaign_id,
    invoiceDocumentNumber,
    actorId: userId,
    touchedLineIds,
    execute: async () => ({ touchedLineIds }),
  });

  if (commitResult.error) {
    if (invoiceMode === "new") {
      await rollbackNewInvoiceDraft(supabase, invoiceId);
    }
    return { ok: false, message: commitResult.error };
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[queue-refresh] invoice created — billing paths revalidated", {
      campaignId: input.campaign_id,
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
    campaignId: input.campaign_id,
  };

}

export async function ungenerateInvoice(supabase: SupabaseClient, userId: string, input: z.infer<typeof ungenerateInvoiceSchema>): Promise<BillingMutationResult> {const auth = await requirePermission(supabase, "finance.regenerate");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, total, subtotal, tax_amount, version_number, regeneration_status, status, is_operational_locked"
    )
    .eq("id", input.invoice_id)
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
    regeneration_reason: input.reason,
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
          ungenerate_reason: input.reason,
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
    reason: input.reason,
    granted_by: auth.userId,
    granted_until: new Date(Date.now() + 72 * 3600000).toISOString(),
  });

  return {
    ok: true,
    message: `Invoice ${invoice.document_number} un-generated. Same number reserved — status: Pending Regeneration.`,
    campaignId: invoice.campaign_header_id ?? undefined,
  };

}

export async function regenerateInvoice(supabase: SupabaseClient, userId: string, input: z.infer<typeof regenerateInvoiceSchema>): Promise<BillingMutationResult> {const auth = await requirePermission(supabase, "finance.regenerate");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, version_number, regeneration_status"
    )
    .eq("id", input.invoice_id)
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

  const requestedLineIds = (input.line_ids ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const requestedDeliverableIds = (input.deliverable_ids ?? "")
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
        reason: `Invoice regeneration: ${input.reason}`,
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
    regeneration_reason: input.reason,
    regenerated_by: auth.userId,
  });

  return {
    ok: true,
    message: `Invoice ${invoice.document_number} regenerated (v${newVersion}). Same invoice number preserved.`,
    campaignId: invoice.campaign_header_id ?? undefined,
  };

}



export async function getInvoiceWorkspace(supabase: SupabaseClient, invoiceId: string): Promise<InvoiceWorkspace | null> {
    const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      client:clients(id, name, document_number),
      campaign:${REL.invoices.campaignHeader}(id, name, document_number)
    `
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return null;

  const inv = invoice as unknown as {
    id: string;
    document_number: string;
    status: string;
    collection_status: InvoiceWorkspace["collection_status"];
    regeneration_status: InvoiceWorkspace["regeneration_status"];
    version_number: number;
    ungenerate_reason: string | null;
    issue_date: string;
    due_date: string | null;
    subtotal: number;
    tax_amount: number;
    total: number;
    amount_paid: number;
    currency: string;
    notes: string | null;
    client: InvoiceWorkspace["client"];
    campaign: InvoiceWorkspace["campaign"];
  };

  const [linesResult, paymentsResult, approvalsResult, auditResult, profilesResult] =
    await Promise.all([
      import("@/lib/finance/invoice-line-registry").then((mod) =>
        mod.reconcileInvoiceHeaderFromLines(supabase, invoiceId)
      ),
      supabase
        .from("payments")
        .select("id, document_number, amount, currency, status, paid_at, payment_method")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_approval_requests")
        .select(
          `
          id, document_number, entity_type, entity_id, approval_stage,
          chain_order, status, title, decided_at,
          assignee:profiles!financial_approval_requests_assigned_to_fkey(full_name, email)
        `
        )
        .eq("entity_id", invoiceId)
        .order("chain_order"),
      supabase
        .from("audit_logs")
        .select("id, action, entity_type, created_at, actor_id")
        .or(
          `and(entity_type.eq.invoices,entity_id.eq.${invoiceId}),entity_type.eq.payments,entity_type.eq.invoice_line_items`
        )
        .order("created_at", { ascending: false })
        .limit(25),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  );

  const total = Number(inv.total);
  const amountPaid = Number(inv.amount_paid);

  const invoiceLines = (() => {
    if (linesResult.integrityWarning && process.env.NODE_ENV === "development") {
      console.warn("[getInvoiceWorkspace]", linesResult.integrityWarning);
    }
    return linesResult.lines.map((row) => ({
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
    }));
  })();

  return {
    id: inv.id,
    document_number: inv.document_number,
    status: inv.status,
    collection_status: inv.collection_status,
    regeneration_status: inv.regeneration_status ?? "active",
    version_number: inv.version_number ?? 1,
    ungenerate_reason: inv.ungenerate_reason,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    subtotal: Number(inv.subtotal),
    tax_amount: Number(inv.tax_amount),
    total,
    amount_paid: amountPaid,
    outstanding: Math.max(0, total - amountPaid),
    currency: inv.currency,
    notes: inv.notes,
    client: inv.client,
    campaign: inv.campaign,
    lines: invoiceLines,
    regeneration_coverage: null,
    payments: (paymentsResult.data ?? []).map((p) => ({
      id: p.id,
      document_number: p.document_number,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      paid_at: p.paid_at,
      payment_method: p.payment_method,
    })),
    approvals: (approvalsResult.data ?? []).map((a) => {
      const row = a as unknown as {
        id: string;
        document_number: string;
        entity_type: string;
        entity_id: string;
        approval_stage: FinancialApprovalRow["approval_stage"];
        chain_order: number;
        status: string;
        title: string;
        decided_at: string | null;
        assignee: { full_name: string | null; email: string } | null;
      };
      return {
        id: row.id,
        document_number: row.document_number,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        approval_stage: row.approval_stage,
        chain_order: row.chain_order,
        status: row.status,
        title: row.title,
        assigned_to_name: row.assignee?.full_name ?? row.assignee?.email ?? null,
        decided_at: row.decided_at,
      };
    }),
    activity: (auditResult.data ?? []).slice(0, 20).map((log) => {
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
          ? { full_name: actor.full_name, email: actor.email }
          : null,
        summary: `${row.action} · ${row.entity_type}`,
      };
    }),
  };
}