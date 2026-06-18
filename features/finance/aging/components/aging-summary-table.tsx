"use client";

import Link from "next/link";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { formatBillingMoney } from "@/features/billing/utils";
import { AGING_BUCKET_LABELS } from "@/lib/collections/aging";
import type { AgingBucket } from "@/lib/collections/aging/types";
import type { ClientAgingSummaryRow } from "@/lib/finance/aging";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

const BUCKET_KEYS: AgingBucket[] = [
  "current",
  "1_30",
  "31_60",
  "61_90",
  "90_plus",
];

function bucketColumns(
  mixedCurrency: boolean
): OperationalConfigurableColumnDef<ClientAgingSummaryRow>[] {
  return BUCKET_KEYS.map((bucket) => ({
    id: bucket,
    label: AGING_BUCKET_LABELS[bucket],
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row: ClientAgingSummaryRow) => {
      const amount = row.buckets[bucket];
      if (amount <= 0) return "—";
      return mixedCurrency
        ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
        : formatBillingMoney(amount, row.currency);
    },
  }));
}

const BASE_COLUMNS: OperationalConfigurableColumnDef<ClientAgingSummaryRow>[] = [
  {
    id: "client",
    label: "Legal entity",
    renderCell: (row) => (
      <Link href={`/clients/${row.client_id}`} className="font-medium hover:underline">
        {row.client_name}
      </Link>
    ),
  },
  {
    id: "currency",
    label: "Currency",
    renderCell: (row) => row.currency,
  },
  {
    id: "total",
    label: "Total outstanding",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatBillingMoney(row.total_outstanding, row.currency),
  },
];

type AgingSummaryTableProps = {
  rows: ClientAgingSummaryRow[];
  mixedCurrency: boolean;
};

export function AgingSummaryTable({ rows, mixedCurrency }: AgingSummaryTableProps) {
  const columns = [...BASE_COLUMNS, ...bucketColumns(mixedCurrency)];

  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.financeAgingSummary}
      columns={columns}
      rows={rows}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Client aging summary"
            actions={
              <OperationalTableControlsSlot contextLabel="client aging summary" />
            }
          />
        }
      >
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">
            No outstanding receivables for this report.
          </p>
        ) : (
          <OperationalConfigurableTable
            columns={columns}
            rows={rows}
            rowKey={(row) => `${row.client_id}-${row.currency}`}
          />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
