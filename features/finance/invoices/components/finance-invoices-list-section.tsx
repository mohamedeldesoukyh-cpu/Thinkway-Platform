"use client";

import { useMemo } from "react";

import { FinanceSuiteCard, FinanceSuiteEmpty, FinanceSuiteKpiStrip } from "@/components/finance/suite";
import { formatKpiCurrency } from "@/components/shared/kpi/kpi-utils";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { formatBillingMoneyCompact } from "@/features/billing/utils";
import {
  FINANCE_INVOICE_REGISTER_COLUMN_METAS_WITH_ACTIONS,
  FinanceInvoiceRegisterTable,
} from "@/features/finance/invoices/components/finance-invoice-register-table";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type FinanceInvoicesListSectionProps = {
  rows: FinanceInvoiceRegisterRow[];
};

export function FinanceInvoicesListSection({ rows }: FinanceInvoicesListSectionProps) {
  const currencies = useMemo(
    () => [...new Set(rows.map((row) => row.currency).filter(Boolean))],
    [rows]
  );
  const mixed = currencies.length > 1;
  const currency = currencies.length === 1 ? currencies[0] : undefined;

  const paid = rows.filter((row) => row.status.toLowerCase() === "paid").length;
  const pending = rows.length - paid;
  const locked = rows.filter((row) =>
    row.locked_status.toLowerCase().includes("lock")
  ).length;
  const exVat = rows.reduce((sum, row) => sum + row.revenue_before_vat, 0);
  const vat = rows.reduce((sum, row) => sum + row.vat_amount, 0);

  const formatKpi = (amount: number) =>
    mixed || !currency
      ? formatKpiCurrency(amount, null, { mixed: true })
      : formatBillingMoneyCompact(amount, currency);

  return (
    <div className="space-y-4">
      <FinanceSuiteKpiStrip
        items={[
          {
            id: "count",
            label: "Invoices",
            value: String(rows.length),
            hint: `${paid} paid, ${pending} pending`,
          },
          {
            id: "exvat",
            label: "Revenue ex-VAT",
            value: formatKpi(exVat),
            hint: mixed ? "mixed currency, unconverted" : currency,
            tone: mixed ? "bad" : undefined,
          },
          {
            id: "vat",
            label: "Output VAT",
            value: formatKpi(vat),
            hint: "14% on every line",
          },
          {
            id: "locked",
            label: "Locked",
            value: String(locked),
            hint:
              locked === rows.length && rows.length > 0
                ? "all rows immutable"
                : "finance lock",
          },
        ]}
      />

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.financeInvoiceRegister}
        columns={operationalColumnsFromMetas(
          FINANCE_INVOICE_REGISTER_COLUMN_METAS_WITH_ACTIONS,
          FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS
        )}
        rows={rows}
        filterAccessors={FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS}
      >
        <FinanceSuiteCard
          title="Invoice register"
          subtitle="revenue before and after VAT · VAT is never part of operational revenue or GP"
          actions={<OperationalTableControlsSlot contextLabel="Invoice register" />}
        >
          {rows.length === 0 ? (
            <FinanceSuiteEmpty
              title="No invoices in this register yet"
              body="The schema is live. Generated invoices appear here with VAT before and after — VAT is never part of operational revenue or GP."
            />
          ) : (
            <FinanceInvoiceRegisterTable rows={rows} showUngenerate />
          )}
        </FinanceSuiteCard>
      </OperationalTableSuiteProvider>
    </div>
  );
}
