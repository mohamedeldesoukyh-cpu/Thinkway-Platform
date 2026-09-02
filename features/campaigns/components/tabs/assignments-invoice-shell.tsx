"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { useInvoiceConfirmFlow } from "@/features/billing/hooks/use-invoice-confirm-flow";

import type {
  AssignmentBillingGroup,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";

const CreateInvoiceSheet = dynamic(
  () =>
    import("@/features/billing/components/create-invoice-sheet").then(
      (m) => m.CreateInvoiceSheet
    ),
  { ssr: false }
);

type AssignmentsInvoiceShellProps = {
  campaignId: string;
  campaignName: string;
  campaignNo: string;
  currencyCode: string;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  invoiceOpen: boolean;
  onInvoiceOpenChange: (open: boolean) => void;
  invoiceSelection: OperationalSelectionPayload | undefined;
};

/** Same confirm-then-create path as Campaign Billing / Assignments tab. */
export function AssignmentsInvoiceShell({
  campaignId,
  campaignName,
  campaignNo,
  currencyCode,
  billingGroups,
  operationalBilling,
  invoiceOpen,
  onInvoiceOpenChange,
  invoiceSelection,
}: AssignmentsInvoiceShellProps) {
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const { requestConfirm, confirmDialog } = useInvoiceConfirmFlow({
    campaignId,
    campaignName,
    campaignNo,
    currency: currencyCode,
    operationalBilling,
    onComplete: refreshAfterOperationalMutation,
  });
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (invoiceOpen && !wasOpenRef.current && operationalBilling) {
      const opened = requestConfirm(invoiceSelection);
      if (!opened) onInvoiceOpenChange(false);
    }
    wasOpenRef.current = invoiceOpen;
  }, [
    invoiceOpen,
    invoiceSelection,
    operationalBilling,
    onInvoiceOpenChange,
    requestConfirm,
  ]);

  if (!operationalBilling) {
    if (!invoiceOpen) return null;
    return (
      <CreateInvoiceSheet
        campaignId={campaignId}
        groups={billingGroups}
        currency={currencyCode}
        open={invoiceOpen}
        onOpenChange={onInvoiceOpenChange}
      />
    );
  }

  return confirmDialog;
}

export function useAssignmentsInvoiceDialog(options: {
  campaignId: string;
  campaignName: string;
  campaignNo: string;
  currency: string;
  operationalBilling: CampaignOperationalBillingDetail | null;
  onComplete?: () => void | Promise<void>;
}) {
  const invoiceConfirm = useInvoiceConfirmFlow(options);
  const [legacyOpen, setLegacyOpen] = useState(false);

  function openInvoiceWithLines(selection: OperationalSelectionPayload) {
    if (!options.operationalBilling) {
      setLegacyOpen(true);
      return;
    }
    invoiceConfirm.requestConfirm(selection);
  }

  return {
    openInvoiceWithLines,
    pending: invoiceConfirm.pending,
    confirmDialog: invoiceConfirm.confirmDialog,
    legacyOpen,
    setLegacyOpen,
  };
}
