"use client";

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
import { formatMoney } from "@/features/vendors/utils";

export function VendorBillingTab({
  workspace,
  currencyOptions = [],
  onCancel,
}: {
  workspace: VendorWorkspace;
  currencyOptions?: { value: string; label: string }[];
  onCancel?: () => void;
}) {
  const currency =
    workspace.bank_accounts.find((b) => b.is_default)?.currency ??
    (workspace.payment_details as { currency?: string })?.currency ??
    "EGP";
  const { financials } = workspace;

  const summaryItems: KpiCarouselItem[] = [
    {
      id: "revenue",
      label: "Assignment revenue",
      value: formatMoney(financials.total_revenue, currency),
      icon: TrendingUpIcon,
      accentKey: "purple",
    },
    {
      id: "cost",
      label: "Creator cost",
      value: formatMoney(financials.total_cost, currency),
      icon: WalletIcon,
      accentKey: "pink",
    },
    {
      id: "gp",
      label: "GP contribution",
      value: formatMoney(financials.total_gp, currency),
      icon: TrendingUpIcon,
      accentKey: "green",
    },
    {
      id: "invoiced",
      label: "Invoiced",
      value: formatMoney(financials.invoiced_amount, currency),
      icon: ReceiptIcon,
      accentKey: "blue",
    },
    {
      id: "paid",
      label: "Paid out",
      value: formatMoney(financials.paid_out, currency),
      icon: WalletIcon,
      accentKey: "green",
    },
    {
      id: "pending",
      label: "Pending payout",
      value: formatMoney(financials.pending_payout, currency),
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
      <div className="grid gap-[18px]">
        <VendorPaymentOpsSection workspace={workspace} />
        <VendorBankAccountsSection workspace={workspace} />
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
