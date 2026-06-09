"use client";

import Link from "next/link";
import { AlertTriangleIcon, LockIcon } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import type { BillingLineRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatPercent } from "@/features/campaigns/utils";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";

type BillingLinesTableProps = {
  lines: BillingLineRow[];
  showCampaign?: boolean;
  currency?: string;
};

function buildBillingLinesColumns(
  showCampaign: boolean,
  currency: string
): OperationalConfigurableColumnDef<BillingLineRow>[] {
  const columns: OperationalConfigurableColumnDef<BillingLineRow>[] = [
    {
      id: "line",
      label: "Line",
      renderCell: (line) => (
        <>
          <p className="font-medium">{line.name}</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            <DocumentNumber value={line.document_number} />
          </p>
        </>
      ),
    },
  ];

  if (showCampaign) {
    columns.push({
      id: "campaign",
      label: "Campaign",
      renderCell: (line) => (
        <Link
          href={`/campaigns/${line.campaign_header_id}?tab=billing`}
          className="hover:underline"
        >
          {line.campaign_name}
        </Link>
      ),
    });
  }

  columns.push(
    {
      id: "client",
      label: "Client",
      cellClassName: "max-w-[120px] truncate",
      renderCell: (line) => line.client_name,
    },
    {
      id: "billing_status",
      label: "Billing status",
      renderCell: (line) => <BillingStatusBadge status={line.billing_status} />,
    },
    {
      id: "revenue",
      label: "Revenue",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (line) => formatBillingMoney(line.revenue, line.currency_code || currency),
    },
    {
      id: "cost",
      label: "Cost",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (line) => formatBillingMoney(line.cost, line.currency_code || currency),
    },
    {
      id: "gp",
      label: "GP",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (line) => {
        const cur = line.currency_code || currency;
        return (
          <>
            <span>{formatBillingMoney(line.gp, cur)}</span>
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({formatPercent(line.margin_percent)})
            </span>
          </>
        );
      },
    },
    {
      id: "po_consumed",
      label: "PO / consumed",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (line) => {
        const cur = line.currency_code || currency;
        return (
          <>
            <div className="flex items-center justify-end gap-1">
              {line.po_over_consumed ? (
                <AlertTriangleIcon className="size-3.5 text-amber-500" />
              ) : null}
              <span>
                {formatBillingMoney(line.po_consumed, cur)} /{" "}
                {formatBillingMoney(line.po_amount, cur)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {formatBillingMoney(line.remaining_po, cur)} remaining
            </p>
          </>
        );
      },
    },
    {
      id: "locks",
      label: "Locks",
      renderCell: (line) => (
        <div className="flex flex-wrap gap-1">
          {line.revenue_locked ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <LockIcon className="size-3" />
              Rev
            </Badge>
          ) : null}
          {line.cost_locked ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <LockIcon className="size-3" />
              Cost
            </Badge>
          ) : null}
          {line.vendor_assignment_locked ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <LockIcon className="size-3" />
              Vendor
            </Badge>
          ) : null}
          {!line.revenue_locked && !line.cost_locked && !line.vendor_assignment_locked ? (
            <span className="text-[10px] text-muted-foreground">—</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "invoice",
      label: "Invoice",
      renderCell: (line) =>
        line.invoice_id ? (
          <Link
            href={`/billing/invoices/${line.invoice_id}`}
            className="text-[11px] tabular-nums hover:underline"
          >
            <DocumentNumber value={line.invoice_document_number} showCanonicalTitle={false} />
          </Link>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        ),
    }
  );

  return columns;
}

export function getBillingLinesColumnMetas(showCampaign = true): OperationalTableColumnMeta[] {
  return getOperationalTableColumnMetas(buildBillingLinesColumns(showCampaign, "USD"));
}

export const BILLING_LINES_REGISTER_COLUMN_METAS = getBillingLinesColumnMetas(true);

export function BillingLinesTable({
  lines,
  showCampaign = true,
  currency = "USD",
}: BillingLinesTableProps) {
  const columns = useMemo(
    () => buildBillingLinesColumns(showCampaign, currency),
    [showCampaign, currency]
  );

  if (lines.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No campaign lines in billing scope.
      </p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={columns}
      rows={lines}
      rowKey={(line) => line.id}
    />
  );
}

type BillingLinesCardProps = BillingLinesTableProps & {
  title?: string;
};

export function BillingLinesCard({
  lines,
  showCampaign = true,
  title = "Campaign line billing",
}: BillingLinesCardProps) {
  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={<CampaignOperationalSectionHeader title={title} />}
    >
      <BillingLinesTable lines={lines} showCampaign={showCampaign} />
    </OperationalTableSection>
  );
}
