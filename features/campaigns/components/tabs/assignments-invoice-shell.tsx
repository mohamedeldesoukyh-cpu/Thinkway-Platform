"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

const InvoiceGenerationSheet = dynamic(
  () =>
    import("@/features/billing/components/invoice-generation-sheet").then(
      (m) => m.InvoiceGenerationSheet
    ),
  { ssr: false }
);

type AssignmentsInvoiceShellProps = {
  campaignId: string;
  currencyCode: string;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  invoiceOpen: boolean;
  onInvoiceOpenChange: (open: boolean) => void;
  invoiceSelection: OperationalSelectionPayload | undefined;
};

export function AssignmentsInvoiceShell({
  campaignId,
  currencyCode,
  billingGroups,
  operationalBilling,
  invoiceOpen,
  onInvoiceOpenChange,
  invoiceSelection,
}: AssignmentsInvoiceShellProps) {
  const router = useRouter();

  if (!invoiceOpen) return null;

  if (operationalBilling) {
    return (
      <InvoiceGenerationSheet
        campaignId={campaignId}
        currency={operationalBilling.currency_code}
        rollup={operationalBilling.rollup}
        operationalRows={operationalBilling.operational_rows ?? []}
        appendableInvoices={operationalBilling.appendable_invoices ?? []}
        defaultVatPercent={operationalBilling.default_vat_percent}
        targetMode="new"
        initialSelection={invoiceSelection}
        open={invoiceOpen}
        onInvoiceComplete={() => router.refresh()}
        onOpenChange={(open) => {
          onInvoiceOpenChange(open);
        }}
      />
    );
  }

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

export function useAssignmentsInvoiceDialog() {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSelection, setInvoiceSelection] = useState<
    OperationalSelectionPayload | undefined
  >();

  function openInvoiceWithLines(lineIds: string[]) {
    setInvoiceSelection({
      line_ids: lineIds,
      deliverable_ids: [],
      post_ids: [],
    });
    setInvoiceOpen(true);
  }

  return {
    invoiceOpen,
    setInvoiceOpen,
    invoiceSelection,
    openInvoiceWithLines,
  };
}
