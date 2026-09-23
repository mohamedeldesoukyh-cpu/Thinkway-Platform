"use client";

import { creatorFinancialDisplay } from "@/features/vendors/financial-display";

import { CreatorPaymentsWorkspace } from '@/features/creator-payments/workspace';

import {
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import { VendorBankAccountsSection } from "@/features/vendors/components/tabs/vendor-bank-accounts-section";
import { VendorBankDetailsSection } from "@/features/vendors/components/tabs/vendor-bank-details-section";
import { VendorFinanceTab } from "@/features/vendors/components/tabs/vendor-finance-tab";
import { VendorPaymentOpsSection } from "@/features/vendors/components/tabs/vendor-payment-ops-section";
import { VendorProfileTabShell } from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorBillingTab({
  workspace,
  currencyOptions = [],
  onCancel,
}: {
  workspace: VendorWorkspace;
  currencyOptions?: { value: string; label: string }[];
  onCancel?: () => void;
}) {
  const display = creatorFinancialDisplay(workspace.assignments, workspace.payouts);

  const summaryItems: KpiCarouselItem[] = [
    {
      id: "revenue",
      label: "Client revenue",
      value: display.revenue,
      icon: TrendingUpIcon,
      accentKey: "purple",
    },
    {
      id: "cost",
      label: "Creator cost",
      value: display.cost,
      icon: WalletIcon,
      accentKey: "pink",
    },
    {
      id: "gp",
      label: "GP contribution",
      value: display.gp,
      icon: TrendingUpIcon,
      accentKey: "green",
    },
    {
      id: "invoiced",
      label: "Invoiced",
      value: display.invoiced,
      icon: ReceiptIcon,
      accentKey: "blue",
    },
    {
      id: "paid",
      label: "Paid out",
      value: display.paid,
      icon: WalletIcon,
      accentKey: "green",
    },
    {
      id: "pending",
      label: "Pending payout",
      value: display.pending,
      icon: ReceiptIcon,
      accentKey: "pink",
    },
  ];

  return (
    <VendorProfileTabShell
      title="Payments"
      description="Payment readiness, PO, IO, signed IO, communication, and payout recording — Profile Completeness never blocks payment."
      onCancel={onCancel}
    >
      <div className="grid min-w-0 grid-cols-1 gap-[18px] [&>*]:min-w-0">
        <VendorBankAccountsSection workspace={workspace} />
        <CreatorPaymentsWorkspace creatorId={workspace.id} />
        <VendorPaymentOpsSection workspace={workspace} />
        <VendorBankDetailsSection workspace={workspace} />

        <VendorFinanceTab
          vendor={workspace}
          currencyOptions={currencyOptions}
          hidePaymentTerms
          embedded
          quotationPriceReference={workspace.quotation_price_reference}
        />

        <KpiStrip items={summaryItems} showNavigation={false} />
      </div>
    </VendorProfileTabShell>
  );
}
