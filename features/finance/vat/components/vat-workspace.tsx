"use client";

import { useMemo, useState } from "react";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  VAT_WORKSPACE_TAB_ORDER,
  VAT_WORKSPACE_TAB_STORAGE_KEY,
  isVatWorkspaceTabId,
  type VatWorkspaceTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import Link from "next/link";

import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
  OperationalDetailRow,
  OperationalWorkspaceSortableTabsBar,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { formatBillingMoney } from "@/features/billing/utils";
import { buildVatAuditCsv } from "@/features/finance/vat/export";
import type {
  VatCountryRow,
  VatEntityRow,
  VatInvoiceRow,
  VatMonthlyRow,
  VatWorkspaceData,
} from "@/features/finance/vat/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type VatWorkspaceProps = {
  data: VatWorkspaceData;
};

const VAT_MONTHLY_COLUMNS: OperationalConfigurableColumnDef<VatMonthlyRow>[] = [
  { id: "month", label: "Month", renderCell: (row) => row.label },
  {
    id: "revenue_ex_vat",
    label: "Revenue ex-VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.revenue_before_vat, "USD"),
  },
  {
    id: "output_vat",
    label: "Output VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.output_vat, "USD"),
  },
  {
    id: "input_vat",
    label: "Input VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.input_vat, "USD"),
  },
  {
    id: "net_payable",
    label: "Net payable",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.net_vat_payable, "USD"),
  },
];

const VAT_COUNTRY_COLUMNS: OperationalConfigurableColumnDef<VatCountryRow>[] = [
  { id: "country", label: "Country", renderCell: (row) => row.country_code },
  {
    id: "output_vat",
    label: "Output VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.output_vat, "USD"),
  },
  {
    id: "input_vat",
    label: "Input VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.input_vat, "USD"),
  },
  {
    id: "net_payable",
    label: "Net payable",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.net_vat_payable, "USD"),
  },
];

const VAT_ENTITY_COLUMNS: OperationalConfigurableColumnDef<VatEntityRow>[] = [
  { id: "entity", label: "Legal entity", renderCell: (row) => row.client_name },
  { id: "country", label: "Country", renderCell: (row) => row.country_code ?? "—" },
  {
    id: "revenue_ex_vat",
    label: "Revenue ex-VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.revenue_before_vat, "USD"),
  },
  {
    id: "output_vat",
    label: "Output VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.output_vat, "USD"),
  },
];

const VAT_INVOICE_COLUMNS: OperationalConfigurableColumnDef<VatInvoiceRow>[] = [
  {
    id: "invoice",
    label: "Invoice",
    monoCell: true,
    renderCell: (row) => formatDocumentNumberForDisplay(row.document_number),
  },
  { id: "client", label: "Client", renderCell: (row) => row.client_name },
  { id: "country", label: "Country", renderCell: (row) => row.country_code ?? "—" },
  {
    id: "ex_vat",
    label: "Ex-VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.revenue_before_vat, row.currency),
  },
  {
    id: "vat",
    label: "VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.output_vat, row.currency),
  },
  {
    id: "total",
    label: "Total",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.total_after_vat, row.currency),
  },
  {
    id: "actions",
    label: "",
    locked: true,
    renderCell: (row) => (
      <Link
        href={`/billing/invoices/${row.id}`}
        className="text-primary hover:underline"
      >
        Open
      </Link>
    ),
  },
];

function ConfigurableVatTable<T>({
  tableId,
  title,
  contextLabel,
  columns,
  rows,
  rowKey,
}: {
  tableId: string;
  title: string;
  contextLabel: string;
  columns: readonly OperationalConfigurableColumnDef<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
}) {
  return (
    <OperationalTableSuiteProvider tableId={tableId} columns={columns} rows={rows}>
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title={title}
            actions={<OperationalTableControlsSlot contextLabel={contextLabel} />}
          />
        }
      >
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">No VAT data yet.</p>
        ) : (
          <OperationalConfigurableTable columns={columns} rows={rows} rowKey={rowKey} />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}

export function VatWorkspace({ data }: VatWorkspaceProps) {
  const [includeVatColumns, setIncludeVatColumns] = useState(true);

  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: VAT_WORKSPACE_TAB_STORAGE_KEY,
    defaultOrder: VAT_WORKSPACE_TAB_ORDER,
    isValidId: isVatWorkspaceTabId,
  });

  const tabsById = useMemo(
    (): Record<VatWorkspaceTabId, OperationalWorkspaceTabDef> => ({
      settlement: { value: "settlement", label: "Settlement" },
      monthly: { value: "monthly", label: "Monthly" },
      country: { value: "country", label: "By country" },
      entity: { value: "entity", label: "By legal entity" },
      invoices: { value: "invoices", label: "By invoice" },
    }),
    []
  );

  const csvContent = useMemo(
    () => buildVatAuditCsv(data, includeVatColumns),
    [data, includeVatColumns]
  );

  function downloadCsv() {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vat-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeVatColumns}
            onChange={(e) => setIncludeVatColumns(e.target.checked)}
            className="size-4 rounded border border-input"
          />
          Include VAT in export
        </label>
        <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
          <DownloadIcon data-icon="inline-start" />
          VAT audit export
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Revenue (ex-VAT)"
          value={formatBillingMoney(data.kpis.revenue_before_vat, "USD")}
        />
        <KpiCard label="Output VAT" value={formatBillingMoney(data.kpis.output_vat, "USD")} />
        <KpiCard label="Input VAT" value={formatBillingMoney(data.kpis.input_vat, "USD")} />
        <KpiCard
          label="Net VAT payable"
          value={formatBillingMoney(data.kpis.net_vat_payable, "USD")}
        />
        <KpiCard
          label="VAT reclaimable"
          value={formatBillingMoney(data.kpis.vat_reclaimable, "USD")}
        />
      </div>

      <Tabs defaultValue="settlement" className="flex flex-col gap-0">
        <OperationalWorkspaceSortableTabsBar
          sectionLabel="VAT workspace"
          tabOrder={tabOrder}
          tabsById={tabsById}
          onReorder={moveTab}
        />

        <TabsContent value="settlement" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <CampaignFlatSection title="VAT settlement summary">
              <OperationalDetailRow
                label="Output VAT (client invoices)"
                value={formatBillingMoney(data.kpis.output_vat, "USD")}
              />
              <OperationalDetailRow
                label="Input VAT (vendor costs)"
                value={formatBillingMoney(data.kpis.input_vat, "USD")}
              />
              <OperationalDetailRow
                label="Net VAT payable"
                value={formatBillingMoney(data.kpis.net_vat_payable, "USD")}
                valueClassName="font-semibold"
              />
              <p className="pt-2 text-xs text-muted-foreground">
                Net payable = Output VAT − Input VAT. Operational revenue, cost, GP, and margin
                never include VAT.
              </p>
            </CampaignFlatSection>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="monthly" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <ConfigurableVatTable
              tableId={OPERATIONAL_TABLE_IDS.financeVatMonthly}
              title="Monthly VAT"
              contextLabel="VAT monthly"
              columns={VAT_MONTHLY_COLUMNS}
              rows={data.monthly}
              rowKey={(row) => row.month}
            />
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="country" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <ConfigurableVatTable
              tableId={OPERATIONAL_TABLE_IDS.financeVatByCountry}
              title="VAT by country"
              contextLabel="VAT by country"
              columns={VAT_COUNTRY_COLUMNS}
              rows={data.by_country}
              rowKey={(row) => row.country_code}
            />
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="entity" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <ConfigurableVatTable
              tableId={OPERATIONAL_TABLE_IDS.financeVatByEntity}
              title="VAT by legal entity"
              contextLabel="VAT by legal entity"
              columns={VAT_ENTITY_COLUMNS}
              rows={data.by_entity}
              rowKey={(row) => row.client_id}
            />
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="invoices" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <ConfigurableVatTable
              tableId={OPERATIONAL_TABLE_IDS.financeVatByInvoice}
              title="VAT by invoice"
              contextLabel="VAT by invoice"
              columns={VAT_INVOICE_COLUMNS}
              rows={data.invoices}
              rowKey={(row) => row.id}
            />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <CampaignFlatSection title={label}>
      <p className="text-lg font-semibold">{value}</p>
    </CampaignFlatSection>
  );
}
