"use client";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
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
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.financeInvoiceRegister}
      columns={operationalColumnsFromMetas(
        FINANCE_INVOICE_REGISTER_COLUMN_METAS_WITH_ACTIONS,
        FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS
      )}
      rows={rows}
      filterAccessors={FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        title="Invoice register"
        description={`${rows.length} invoice${rows.length === 1 ? "" : "s"} in the system.`}
        actions={<OperationalTableControlsSlot contextLabel="Invoice register" />}
      >
        <FinanceInvoiceRegisterTable rows={rows} showUngenerate />
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
