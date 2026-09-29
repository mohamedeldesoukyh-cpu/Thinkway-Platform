"use client";

import { originalBillingRows } from "@/lib/billing/billing-currency";
import { startTransition, useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  createSelectedClientInvoicesAction,
  type BillingActionState,
} from "@/features/billing/actions";
import type { InvoiceTargetMode } from "@/features/billing/components/invoice-target-choice-dialog";
import type { AppendableInvoiceOption } from "@/features/billing/types";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import { isInvoiceExistingTarget } from "@/lib/billing/invoice-existing-target";
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
  return invoices.filter((invoice) =>
    isInvoiceExistingTarget({
      status: invoice.status,
      regeneration_status: invoice.regeneration_status,
      is_operational_locked: invoice.is_locked,
      currency: invoice.currency,
      client_id: invoice.client_id,
      campaign_header_id: invoice.campaign_header_id,
      target_currency: invoice.currency,
      target_client_id: invoice.client_id,
      target_campaign_id: invoice.campaign_header_id ?? "",
    })
  );
}

export function useOperationalInvoiceCreate(options?: {
  onComplete?: (campaignId: string) => void | Promise<void>;
  onError?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createSelectedClientInvoicesAction,
    { ok: false } satisfies BillingActionState
  );
  const handledRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const onCompleteRef = useRef(options?.onComplete);
  useLayoutEffect(() => { onCompleteRef.current = options?.onComplete; }, [options?.onComplete]);
  const onErrorRef = useRef(options?.onError);
  useLayoutEffect(() => { onErrorRef.current = options?.onError; }, [options?.onError]);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);

  useEffect(() => {
    if (!state.message) return;
    const actionKey = `${state.ok}:${state.message}:${state.invoiceId ?? ""}`;
    if (handledRef.current === actionKey) return;
    handledRef.current = actionKey;

    submittingRef.current = false;
    setPendingCampaignId(null);

    if (state.ok) {
      showSuccessToastOnce(state.message, { id: "invoice-generation", duration: 6000 });
      const campaignId = state.campaignId;
      if (campaignId) void onCompleteRef.current?.(campaignId);
      return;
    }
    onErrorRef.current?.();
    if (state.completedCount && state.campaignId) void onCompleteRef.current?.(state.campaignId);
    showErrorToastOnce(state.message, { id: "invoice-generation" });
  }, [state]);

  function submit(input: {
    campaignId: string;
    rows: OperationalBillingRow[];
    percents: InvoiceDraftPercents;
    selection: OperationalSelectionPayload;
    mode: InvoiceTargetMode;
    existingInvoiceId?: string;
    grouping?: "combined" | "separate";
  }): boolean {
    if (submittingRef.current) return false;
    const resolved =
      countSubmitPayload(input.selection) > 0
        ? selectionToSubmitPayload(payloadToSelection(input.selection), input.rows)
        : input.selection;
    const bundle = buildInvoiceDraftSubmit(originalBillingRows(input.rows), input.percents, resolved);
    if (countSubmitPayload(bundle.payload) === 0) {
      showErrorToastOnce("Set Invoice % above 0 on at least one selected row.", {
        id: "invoice-generation",
      });
      return false;
    }

    submittingRef.current = true;
    resetToastOnce("invoice-generation");
    handledRef.current = null;
    setPendingCampaignId(input.campaignId);
    const formData = buildCreateInvoiceFormData({
      campaignId: input.campaignId,
      payload: bundle.payload,
      allocations: bundle.allocations,
      invoiceMode: input.mode,
      existingInvoiceId: input.existingInvoiceId,
    });
    startTransition(() => {
      formData.set("invoice_grouping", input.grouping ?? "combined");
      formAction(formData);
    });
    return true;
  }

  return { submit, pending, pendingCampaignId };
}
