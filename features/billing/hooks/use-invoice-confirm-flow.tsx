"use client";

import { useCallback, useRef, useState } from "react";

import {
  InvoiceConfirmDialog,
  type InvoiceConfirmCampaignPreview,
} from "@/features/billing/components/invoice-confirm-dialog";
import type { InvoiceTargetMode } from "@/features/billing/components/invoice-target-choice-dialog";
import { useOperationalInvoiceCreate } from "@/features/billing/hooks/use-operational-invoice-create";
import type { CampaignOperationalBillingDetail } from "@/features/billing/types";
import { buildConsolidatedQueueInvoiceSelection } from "@/lib/billing/consolidated-invoice-queue";
import {
  buildInvoiceConfirmPreview,
  type InvoiceDraftPercents,
} from "@/lib/billing/operational-invoice-draft";
import {
  countSubmitPayload,
  payloadToSelection,
  selectionToSubmitPayload,
  type OperationalSelectionPayload,
} from "@/lib/billing/operational-selection";
import { showErrorToastOnce } from "@/lib/ui/toast-once";

export type InvoiceConfirmFlowMeta = {
  campaignId: string;
  campaignName: string;
  campaignNo: string;
  currency: string;
};

function resolveConfirmSelection(
  rows: CampaignOperationalBillingDetail["operational_rows"],
  selection?: OperationalSelectionPayload
): OperationalSelectionPayload | null {
  if (selection === undefined) {
    return buildConsolidatedQueueInvoiceSelection(rows);
  }
  if (countSubmitPayload(selection) === 0) {
    return null;
  }
  return selectionToSubmitPayload(payloadToSelection(selection), rows);
}

export function buildOperationalInvoiceConfirmPreview(
  detail: CampaignOperationalBillingDetail,
  meta: InvoiceConfirmFlowMeta,
  selection?: OperationalSelectionPayload,
  percents: InvoiceDraftPercents = {}
): InvoiceConfirmCampaignPreview | null {
  const payload = resolveConfirmSelection(detail.operational_rows, selection);
  if (!payload) return null;
  const totals = buildInvoiceConfirmPreview({
    rows: detail.operational_rows,
    percents,
    selection: payload,
    campaignTotal: detail.rollup.total_campaign_amount,
    alreadyInvoiced: detail.rollup.already_invoiced,
    remainingToInvoice: detail.rollup.remaining_to_invoice,
  });
  if (totals.lines.length === 0) return null;
  return {
    campaignId: meta.campaignId,
    campaignName: meta.campaignName,
    campaignNo: meta.campaignNo,
    currency: meta.currency,
    ...totals,
  };
}

type UseInvoiceConfirmFlowOptions = InvoiceConfirmFlowMeta & {
  operationalBilling: CampaignOperationalBillingDetail | null;
  percents?: InvoiceDraftPercents;
  onComplete?: () => void | Promise<void>;
};

/** Shared Assignments + Campaign Billing confirm-then-create path (same as /billing). */
export function useInvoiceConfirmFlow({
  campaignId,
  campaignName,
  campaignNo,
  currency,
  operationalBilling,
  percents = {},
  onComplete,
}: UseInvoiceConfirmFlowOptions) {
  const operationalBillingRef = useRef(operationalBilling);
  operationalBillingRef.current = operationalBilling;
  const percentsRef = useRef(percents);
  percentsRef.current = percents;
  const metaRef = useRef({ campaignId, campaignName, campaignNo, currency });
  metaRef.current = { campaignId, campaignName, campaignNo, currency };
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const { submit, pending } = useOperationalInvoiceCreate({
    onComplete: () => onCompleteRef.current?.(),
  });

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<InvoiceConfirmCampaignPreview | null>(null);
  const selectionRef = useRef<OperationalSelectionPayload | undefined>(undefined);

  const requestConfirm = useCallback((inputSelection?: OperationalSelectionPayload): boolean => {
    const detail = operationalBillingRef.current;
    if (!detail) return false;
    const payload = resolveConfirmSelection(detail.operational_rows, inputSelection);
    if (!payload) {
      showErrorToastOnce("Select at least one billable assignment.", {
        id: "invoice-generation",
      });
      return false;
    }
    const nextPreview = buildOperationalInvoiceConfirmPreview(
      detail,
      metaRef.current,
      payload,
      percentsRef.current
    );
    if (!nextPreview) {
      showErrorToastOnce("Set Invoice % above 0 on at least one selected row.", {
        id: "invoice-generation",
      });
      return false;
    }
    selectionRef.current = payload;
    setPreview(nextPreview);
    setOpen(true);
    return true;
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setPreview(null);
    }
  }, []);

  const handleConfirm = useCallback(
    (mode: InvoiceTargetMode, existingInvoiceId?: string) => {
      const detail = operationalBillingRef.current;
      const payload = selectionRef.current;
      if (!detail || !payload) return;
      setOpen(false);
      submit({
        campaignId: metaRef.current.campaignId,
        rows: detail.operational_rows,
        percents: percentsRef.current,
        selection: payload,
        mode,
        existingInvoiceId,
      });
    },
    [submit]
  );

  const confirmDialog = (
    <InvoiceConfirmDialog
      open={open && preview != null}
      onOpenChange={handleOpenChange}
      campaigns={preview ? [preview] : []}
      appendableInvoices={operationalBilling?.appendable_invoices ?? []}
      pending={pending}
      onConfirm={handleConfirm}
    />
  );

  return { requestConfirm, pending, confirmDialog };
}
