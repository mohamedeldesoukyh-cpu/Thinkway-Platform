"use client";

import Link from "next/link";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { formatMoney } from "@/features/campaigns/utils";
import { resolveCampaignListPoBudget } from "@/lib/finance/po/operational-budget";
import {
  PO_ALERT_FRAME,
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
  resolvePoAlertStatus,
} from "@/lib/finance/po/status";
import type { CampaignListItem } from "@/types/database";
import { formatGroupDisplayName } from "@/lib/groups/group-display";
import { cn } from "@/lib/utils";

type CampaignsTableProps = {
  campaigns: CampaignListItem[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}

function campaignPoBudget(campaign: CampaignListItem) {
  return resolveCampaignListPoBudget(campaign);
}

function listPoAlertStatus(campaign: CampaignListItem) {
  const budget = campaignPoBudget(campaign);
  const consumed = Number(campaign.po_consumed_amount ?? 0);
  return resolvePoAlertStatus({
    po_status: campaign.po_status ?? "draft",
    po_exceeded: budget > 0 && consumed > budget,
  });
}

export const CAMPAIGNS_TABLE_COLUMNS: OperationalConfigurableColumnDef<CampaignListItem>[] = [
  {
    id: "document_number",
    label: "Campaign #",
    renderCell: (campaign) => (
      <Link
        href={`/campaigns/${campaign.id}`}
        className="text-muted-foreground hover:text-foreground hover:underline"
      >
        <DocumentNumber value={campaign.document_number} />
      </Link>
    ),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "name",
    label: "Name",
    renderCell: (campaign) => (
      <Link
        href={`/campaigns/${campaign.id}`}
        className="font-medium text-foreground hover:text-primary hover:underline"
      >
        {campaign.name}
      </Link>
    ),
  },
  {
    id: "brand",
    label: "Brand",
    renderCell: (campaign) => campaign.brand?.name ?? "—",
    cellClassName: "text-muted-foreground",
  },
  {
    id: "group_client",
    label: "Group · Legal entity",
    renderCell: (campaign) => (
      <>
        {formatGroupDisplayName(campaign.group?.name)}
        {campaign.client?.legal_name || campaign.client?.name
          ? ` · ${campaign.client.legal_name ?? campaign.client.name}`
          : ""}
      </>
    ),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "lines",
    label: "Lines",
    renderCell: (campaign) =>
      campaign.lines.length > 0 ? (
        <Badge
          variant="outline"
          className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
          title={campaign.lines
            .map((line) => formatDocumentNumberForDisplay(line.document_number))
            .join(", ")}
        >
          {campaign.lines.length} {campaign.lines.length === 1 ? "line" : "lines"}
        </Badge>
      ) : (
        "—"
      ),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (campaign) => (
      <CampaignStatusBadge
        status={campaign.status}
        className={OPERATIONAL_CHROME_STATUS_BADGE}
      />
    ),
  },
  {
    id: "po_total",
    label: "PO total",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (campaign) => {
      const poAlertStatus = listPoAlertStatus(campaign);
      return (
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              poAlertStatus === "exceeded" && "text-red-600 dark:text-red-400",
              poAlertStatus === "near_limit" && "text-amber-700 dark:text-amber-300"
            )}
          >
            {formatMoney(campaignPoBudget(campaign), campaign.currency_code)}
          </span>
          {campaign.po_status && campaign.po_status !== "draft" ? (
            <Badge
              variant={PO_STATUS_VARIANT[campaign.po_status]}
              className={cn(
                OPERATIONAL_CHROME_STATUS_BADGE,
                "font-normal",
                poAlertStatus && "border-2",
                poAlertStatus && PO_ALERT_FRAME[poAlertStatus]
              )}
            >
              {PO_STATUS_LABELS[campaign.po_status]}
            </Badge>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "dates",
    label: "Dates",
    renderCell: (campaign) =>
      `${formatDate(campaign.start_date)} – ${formatDate(campaign.end_date)}`,
    cellClassName: "whitespace-nowrap text-muted-foreground",
  },
];

export const CAMPAIGNS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(
  CAMPAIGNS_TABLE_COLUMNS
);

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <OperationalConfigurableTable
      columns={CAMPAIGNS_TABLE_COLUMNS}
      rows={campaigns}
      rowKey={(campaign) => campaign.id}
    />
  );
}
