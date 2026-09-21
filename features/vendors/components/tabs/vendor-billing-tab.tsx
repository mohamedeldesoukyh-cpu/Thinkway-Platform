"use client";

import { CreatorPaymentsWorkspace } from '@/features/creator-payments/workspace';
import { CrmAaibBankEditor } from '@/features/creator-payments/bank-editor';

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
  const payoutTotal = (paid: boolean) => {
    const totals=new Map<string,number>();
    for(const row of workspace.payouts){
      if(!paid&&row.status==='cancelled') continue;
      const paidAmount=row.paid_amount??(row.status==='paid'?row.amount:0);
      const amount=paid?paidAmount:Math.max(0,row.amount-paidAmount);
      totals.set(row.currency,(totals.get(row.currency)??0)+amount);
    }
    return [...totals].map(([code,amount])=>formatMoney(amount,code)).join(' · ') || formatMoney(0,currency);
  };

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
      value: payoutTotal(true),
      icon: WalletIcon,
      accentKey: "green",
    },
    {
      id: "pending",
      label: "Pending payout",
      value: payoutTotal(false),
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
        <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">AAIB beneficiary bank details</summary><CrmAaibBankEditor creatorId={workspace.id} details={(workspace.payment_details ?? {}) as Record<string, unknown>} /></details>
        <CreatorPaymentsWorkspace creatorId={workspace.id} />
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
