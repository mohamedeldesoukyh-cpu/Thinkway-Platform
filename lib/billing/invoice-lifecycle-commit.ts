import type { SupabaseClient } from "@supabase/supabase-js";

import {
  captureInvoiceLifecycleSnapshot,
  logInvoiceLifecycleTransition,
} from "@/lib/billing/invoice-lifecycle-debug";
import {
  relockInvoiceOperationalScope,
  unlockInvoiceOperationalScope,
  type InvoiceOperationalUnlockMode,
} from "@/lib/billing/invoice-lifecycle-operational";
import { recalculateInvoiceTotals } from "@/lib/billing/invoice-from-deliverables";
import { ensureInvoiceFinanceDocument } from "@/lib/finance/finance-document-registry";
import { devLog } from "@/lib/dev-log";

export type InvoiceLifecycleMutation =
  | "create"
  | "append"
  | "regenerate"
  | "ungenerate"
  | "void";

export type InvoiceLifecycleCommitInput = {
  mutation: InvoiceLifecycleMutation;
  invoiceId: string;
  campaignId?: string;
  invoiceDocumentNumber?: string;
  actorId?: string | null;
  touchedLineIds?: string[];
  /** Runs validation + line item mutations only. No totals/sync here. */
  execute: () => Promise<{
    error?: string;
    touchedLineIds?: string[];
    lineItemOps?: import("@/lib/billing/invoice-lifecycle-debug").InvoiceLineItemOpSummary;
  }>;
  unlockMode?: InvoiceOperationalUnlockMode;
  /** Ungenerate preserves line items; void/unpost clear them. */
  preserveLineItems?: boolean;
  lineItemOps?: import("@/lib/billing/invoice-lifecycle-debug").InvoiceLineItemOpSummary;
};

export type InvoiceLifecycleCommitResult = {
  error?: string;
  lineIds: string[];
};

/**
 * PR3: Centralized billing lifecycle commit pipeline.
 * All invoice mutations must complete through this function.
 */
export async function commitInvoiceLifecycleMutation(
  supabase: SupabaseClient,
  input: InvoiceLifecycleCommitInput
): Promise<InvoiceLifecycleCommitResult> {
  const phaseStart = `${input.mutation}:commit:start`;
  const phaseEnd = `${input.mutation}:commit:complete`;

  const before =
    input.mutation === "append" || input.mutation === "regenerate"
      ? await captureInvoiceLifecycleSnapshot(
          supabase,
          input.invoiceId,
          input.touchedLineIds ?? []
        )
      : null;

  logInvoiceLifecycleTransition({
    flow: input.mutation === "append" ? "append" : input.mutation === "create" ? "new" : "regenerate",
    phase: phaseStart,
    invoiceId: input.invoiceId,
    invoiceDocumentNumber: input.invoiceDocumentNumber,
    touchedLineIds: input.touchedLineIds,
    before,
  });

  const executeResult = await input.execute();
  if (executeResult.error) {
    return { error: executeResult.error, lineIds: [] };
  }

  const touchedLineIds = [
    ...new Set([...(input.touchedLineIds ?? []), ...(executeResult.touchedLineIds ?? [])]),
  ].filter(Boolean);
  const lineItemOps = executeResult.lineItemOps ?? input.lineItemOps;

  if (input.mutation === "ungenerate" || input.mutation === "void") {
    const unlock = await unlockInvoiceOperationalScope(supabase, input.invoiceId, {
      mode: input.unlockMode ?? (input.mutation === "void" ? "void" : "regeneration"),
      preserveLineItems:
        input.preserveLineItems ?? input.mutation === "ungenerate",
    });
    if (unlock.error) {
      return { error: unlock.error, lineIds: unlock.lineIds };
    }

    logInvoiceLifecycleTransition({
      flow: "regenerate",
      phase: phaseEnd,
      invoiceId: input.invoiceId,
      invoiceDocumentNumber: input.invoiceDocumentNumber,
      touchedLineIds: unlock.lineIds,
      lineItemOps,
      lockResolvedLineIds: unlock.lineIds,
    });

    return { lineIds: unlock.lineIds };
  }

  const recalculateResult = await recalculateInvoiceTotals(supabase, input.invoiceId);
  if (recalculateResult.error) {
    return { error: recalculateResult.error, lineIds: [] };
  }

  await ensureInvoiceFinanceDocument(supabase, input.invoiceId, input.actorId ?? null);

  const relock = await relockInvoiceOperationalScope(supabase, input.invoiceId, {
    billingStatus: "invoiced",
  });

  if (relock.error) {
    return { error: relock.error, lineIds: relock.lineIds };
  }

  const after = await captureInvoiceLifecycleSnapshot(
    supabase,
    input.invoiceId,
    touchedLineIds.length > 0 ? touchedLineIds : relock.lineIds
  );

  logInvoiceLifecycleTransition({
    flow:
      input.mutation === "append"
        ? "append"
        : input.mutation === "create"
          ? "new"
          : "regenerate",
    phase: phaseEnd,
    invoiceId: input.invoiceId,
    invoiceDocumentNumber: input.invoiceDocumentNumber,
    touchedLineIds: touchedLineIds.length > 0 ? touchedLineIds : relock.lineIds,
    before,
    after,
    lineItemOps,
    recalculateError: null,
    lockResolvedLineIds: relock.lineIds,
  });

  if (process.env.NODE_ENV === "development") {
    devLog("[invoice-lifecycle-commit] complete", {
      mutation: input.mutation,
      invoiceId: input.invoiceId,
      lineIds: relock.lineIds,
      hasDuplicateLineItems:
        after.duplicatePostLinks.length > 0 || after.duplicateDeliverableLinks.length > 0,
    });
  }

  return { lineIds: relock.lineIds };
}
