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
import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
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
import { campaignPortfolioIntel } from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import { campaignProcessCueFromListItem } from "@/features/campaigns/lifecycle/campaign-process-presentation";
import type { CampaignListItem } from "@/types/database";
import { formatGroupDisplayName } from "@/lib/groups/group-display";
import { campaignDetailPathWithTab } from "@/lib/routing/entity-paths";
import { cn } from "@/lib/utils";

function campaignOpenHref(campaign: CampaignListItem) {
  const cue = campaignProcessCueFromListItem(campaign);
  return campaignDetailPathWithTab(campaign, cue.entryStageId);
}

type CampaignsTableProps = {
  campaigns: CampaignListItem[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) {
    return "—";
  }
  if (!start) {
    return formatDate(end);
  }
  if (!end || start === end) {
    return formatDate(start);
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
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

function riskBadgeClass(risk: ReturnType<typeof campaignPortfolioIntel>["risk"]) {
  switch (risk) {
    case "critical":
      return "border-red-300 text-red-700";
    case "elevated":
      return "border-amber-300 text-amber-800";
    case "watch":
      return "border-blue-300 text-blue-700";
    default:
      return "border-emerald-300 text-emerald-800";
  }
}

export const CAMPAIGNS_TABLE_COLUMNS: OperationalConfigurableColumnDef<CampaignListItem>[] = [
  {
    id: "document_number",
    label: "Campaign #",
    colWidth: "8%",
    renderCell: (campaign) => (
      <Link href={campaignOpenHref(campaign)} className="platform-v6-link">
        <DocumentNumber value={campaign.document_number} />
      </Link>
    ),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "name",
    label: "Campaign",
    colWidth: "13%",
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <Link
          href={campaignDetailPathWithTab(campaign, intel.nextActionTab)}
          className="text-xs font-semibold text-[var(--tw-text)] no-underline hover:text-[var(--tw-blue)]"
          title={`${intel.businessStageLabel} · ${intel.businessStateLabel}`}
        >
          {campaign.name}
        </Link>
      );
    },
  },
  {
    id: "brand",
    label: "Brand",
    colWidth: "8%",
    renderCell: (campaign) => campaign.brand?.name ?? "—",
    cellClassName: "text-muted-foreground",
  },
  {
    id: "stage",
    label: "Business Stage",
    colWidth: "9%",
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <Link
          href={campaignDetailPathWithTab(campaign, intel.nextActionTab)}
          className="text-xs font-medium text-[var(--tw-text)] no-underline hover:text-[var(--tw-blue)] hover:underline"
          title={`${intel.businessStateLabel} · Owner: ${intel.owner}`}
        >
          {intel.businessStageLabel}
        </Link>
      );
    },
  },
  {
    id: "waiting_for",
    label: "Waiting For",
    colWidth: "8%",
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <span
          className="text-xs text-[var(--tw-text)]"
          title={intel.reason}
        >
          {intel.waitingFor}
        </span>
      );
    },
    cellClassName: "text-muted-foreground",
  },
  {
    id: "days_waiting",
    label: "Days Waiting",
    colWidth: "7%",
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <span
          className={cn(
            "text-xs tabular-nums",
            intel.daysWaiting != null && intel.daysWaiting >= 7 && "font-semibold text-amber-800",
            intel.daysWaiting != null && intel.daysWaiting >= 14 && "text-red-700"
          )}
          title={
            intel.daysWaiting == null
              ? "Not waiting"
              : `${intel.daysWaiting} day(s) in ${intel.businessStateLabel}`
          }
        >
          {intel.daysWaitingLabel}
        </span>
      );
    },
  },
  {
    id: "risk",
    label: "Risk",
    colWidth: "8%",
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <Badge
          variant="outline"
          className={cn(
            OPERATIONAL_CHROME_STATUS_BADGE,
            "font-normal",
            riskBadgeClass(intel.risk)
          )}
          title={`${intel.businessStateLabel} · ${intel.reason}`}
        >
          {intel.riskLabel}
        </Badge>
      );
    },
  },
  {
    id: "next_action",
    label: "Next Action",
    colWidth: "12%",
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <Link
          href={campaignDetailPathWithTab(campaign, intel.nextActionTab)}
          className="text-xs font-semibold text-[var(--tw-blue)] no-underline hover:underline"
          title={`${intel.nextAction} · Owner: ${intel.owner} · ${intel.reason}`}
        >
          {intel.nextAction}
        </Link>
      );
    },
  },
  {
    id: "group_client",
    label: "Group · Legal entity",
    colWidth: "10%",
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
    colWidth: "5%",
    renderCell: (campaign) =>
      campaign.lines.length > 0 ? (
        <Badge
          variant="outline"
          className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
          title={campaign.lines
            .map((line) => formatDocumentNumberForDisplay(line.document_number))
            .join(", ")}
        >
          {campaign.lines.length}
        </Badge>
      ) : (
        "—"
      ),
  },
  {
    id: "status",
    label: "Status",
    colWidth: "6%",
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
    colWidth: "8%",
    amountCell: true,
    renderCell: (campaign) => {
      const poAlertStatus = listPoAlertStatus(campaign);
      return (
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "platform-v6-num font-semibold",
              poAlertStatus === "exceeded" && "platform-v6-c-red",
              poAlertStatus === "near_limit" && "platform-v6-c-amber"
            )}
          >
            {formatMoney(campaignPoBudget(campaign), campaign.currency_code)}
          </span>
          {poAlertStatus === "near_limit" ? (
            <span className={platformV6BadgeClass("outline-amber")}>Near limit</span>
          ) : campaign.po_status && campaign.po_status !== "draft" ? (
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
    colWidth: "7%",
    renderCell: (campaign) =>
      formatDateRange(campaign.start_date, campaign.end_date),
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
