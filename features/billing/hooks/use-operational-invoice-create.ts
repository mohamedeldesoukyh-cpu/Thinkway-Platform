"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

import {
  createInvoiceFromLinesAction,
  type BillingActionState,
} from "@/features/billing/actions";
import type { InvoiceTargetMode } from "@/features/billing/components/invoice-target-choice-dialog";
import type { AppendableInvoiceOption } from "@/features/billing/types";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import { isAppendableInvoiceStatus } from "@/lib/billing/invoice-status";
import {
  buildCreateInvoiceFormData,
  buildInvoiceDraftSubmit,
  type InvoiceDraftPercents,
} from "@/lib/billing/operational-invoice-draft";
import {
  countSubmitPayload,
  payloadToSelection,
  selectionToSubmitPayload,
  type OperationalSelectionPayload,
} from "@/lib/billing/operational-selection";
import {
  resetToastOnce,
  showErrorToastOnce,
  showSuccessToastOnce,
} from "@/lib/ui/toast-once";

export function eligibleAppendableInvoices(
  invoices: AppendableInvoiceOption[]
): AppendableInvoiceOption[] {
  return invoices.filter(
    (invoice) =>
      !invoice.is_locked &&
      invoice.status !== "void" &&
      invoice.status !== "paid" &&
      invoice.regeneration_status !== "pending_regeneration" &&
      isAppendableInvoiceStatus(invoice.status)
  );
}

export function useOperationalInvoiceCreate(options?: {
  onComplete?: (campaignId: string) => void | Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(
    createInvoiceFromLinesAction,
    { ok: false } satisfies BillingActionState
  );
  const handledRef = useRef<string | null>(null);
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;

  useEffect(() => {
    if (!state.message) return;
    const actionKey = `${state.ok}:${state.message}:${state.invoiceId ?? ""}`;
    if (handledRef.current === actionKey) return;
    handledRef.current = actionKey;

    if (state.ok) {
      showSuccessToastOnce(state.message, { id: "invoice-generation", duration: 6000 });
      const campaignId = state.campaignId;
      if (campaignId) void onCompleteRef.current?.(campaignId);
      return;
    }
    showErrorToastOnce(state.message, { id: "invoice-generation" });
  }, [state.message, state.ok, state.invoiceId, state.campaignId]);

  function submit(input: {
    campaignId: string;
    rows: OperationalBillingRow[];
    percents: InvoiceDraftPercents;
    selection: OperationalSelectionPayload;
    mode: InvoiceTargetMode;
    existingInvoiceId?: string;
  }): boolean {
    const resolved =
      countSubmitPayload(input.selection) > 0
        ? selectionToSubmitPayload(payloadToSelection(input.selection), input.rows)
        : input.selection;
    const bundle = buildInvoiceDraftSubmit(input.rows, input.percents, resolved);
    if (countSubmitPayload(bundle.payload) === 0) {
      showErrorToastOnce("Set Invoice % above 0 on at least one selected row.", {
        id: "invoice-generation",
      });
      return false;
    }

    resetToastOnce("invoice-generation");
    handledRef.current = null;
    const formData = buildCreateInvoiceFormData({
      campaignId: input.campaignId,
      payload: bundle.payload,
      allocations: bundle.allocations,
      invoiceMode: input.mode,
      existingInvoiceId: input.existingInvoiceId,
    });
    startTransition(() => {
      formAction(formData);
    });
    return true;
  }

  return { submit, pending };
}
