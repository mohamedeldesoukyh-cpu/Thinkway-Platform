"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

import { useOperationalTableColumnsContext } from "@/components/tables/operational-table-column-context";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import {
  getOperationalTableColumnMetas,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { CampaignListClientLinkCell } from "@/features/campaigns/components/campaign-list-client-link-cell";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { resolveCampaignListPoBudget } from "@/lib/finance/po/operational-budget";
import {
  PO_STATUS_LABELS,
  resolvePoAlertStatus,
} from "@/lib/finance/po/status";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { CAMPAIGN_STATUS_OPTIONS } from "@/features/campaigns/constants";
import { campaignPortfolioIntel } from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import { campaignProcessCueFromListItem } from "@/features/campaigns/lifecycle/campaign-process-presentation";
import type { CampaignListItem, CampaignStatus } from "@/types/database";
import { formatGroupDisplayName } from "@/lib/groups/group-display";
import { campaignDetailPathWithTab } from "@/lib/routing/entity-paths";
import { formatDesignDateRange } from "@/lib/design/format-design-date";
import { cn } from "@/lib/utils";

/** Spec §5.1 — CSS Grid tracks excluding the leading select column. */
const CAMPAIGNS_LIST_TRACKS: Record<string, string> = {
  document_number: "96px",
  name: "minmax(150px, 1.3fr)",
  brand: "112px",
  stage: "104px",
  waiting_for: "92px",
  days_waiting: "58px",
  risk: "62px",
  next_action: "128px",
  group_client: "minmax(140px, 1fr)",
  lines: "52px",
  status: "128px",
  client_link: "96px",
  po_total: "150px",
  dates: "116px",
};

const SELECT_TRACK = "30px";

function campaignOpenHref(campaign: CampaignListItem) {
  const cue = campaignProcessCueFromListItem(campaign);
  return campaignDetailPathWithTab(campaign, cue.entryStageId);
}

type CampaignsTableProps = {
  campaigns: CampaignListItem[];
};

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
      return "p-r";
    case "elevated":
      return "p-y";
    case "watch":
      return "p-b";
    default:
      return "p-g";
  }
}

function statusPillClass(status: CampaignStatus) {
  switch (status) {
    case "completed":
      return "p-g";
    case "active":
      return "p-b";
    case "paused":
    case "cancelled":
      return "p-y";
    default:
      return "p-n";
  }
}

function statusLabel(status: CampaignStatus) {
  return (
    CAMPAIGN_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function poPillClass(
  alert: ReturnType<typeof listPoAlertStatus>,
  poStatus: string | null | undefined
) {
  if (alert === "exceeded") return "p-r";
  if (alert === "near_limit" || poStatus === "near_limit") return "p-y";
  if (!poStatus || poStatus === "draft") return "p-n";
  return "p-g";
}

function brandCell(campaign: CampaignListItem) {
  const brandName = campaign.brand?.name?.trim() ?? "";
  if (!brandName) {
    return <span className="tw-miss">not set</span>;
  }
  if (brandName.toLowerCase() === campaign.name.trim().toLowerCase()) {
    return (
      <span className="tw-miss" title={brandName}>
        same as campaign
      </span>
    );
  }
  return (
    <span className="tw-br" title={brandName}>
      {brandName}
    </span>
  );
}

function datesCell(campaign: CampaignListItem) {
  const label = formatDesignDateRange(campaign.start_date, campaign.end_date);
  if (label === "not set") {
    return <span className="tw-miss">not set</span>;
  }
  return (
    <span className="tw-d" title={label}>
      {label}
    </span>
  );
}

export const CAMPAIGNS_TABLE_COLUMNS: OperationalConfigurableColumnDef<CampaignListItem>[] = [
  {
    id: "document_number",
    label: "Campaign #",
    renderHeader: () => <>Campaign&nbsp;#</>,
    renderCell: (campaign) => (
      <Link href={campaignOpenHref(campaign)} className="tw-id" title={campaign.document_number}>
        <DocumentNumber value={campaign.document_number} />
      </Link>
    ),
  },
  {
    id: "name",
    label: "Campaign",
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <Link
          href={campaignDetailPathWithTab(campaign, intel.nextActionTab)}
          className="tw-nm"
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
    renderCell: brandCell,
  },
  {
    id: "stage",
    label: "Stage",
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <Link
          href={campaignDetailPathWithTab(campaign, intel.nextActionTab)}
          className="tw-t"
          title={`${intel.businessStateLabel} · Owner: ${intel.owner}`}
        >
          {intel.businessStageLabel}
        </Link>
      );
    },
  },
  {
    id: "waiting_for",
    label: "Waiting for",
    renderHeader: () => <>Waiting&nbsp;for</>,
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <span className="tw-t" title={intel.reason}>
          {intel.waitingFor}
        </span>
      );
    },
  },
  {
    id: "days_waiting",
    label: "Days",
    renderHeader: () => <span className="tw-rr">Days</span>,
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <span
          className={cn(
            "tw-v tw-rr",
            intel.daysWaiting == null && "z",
            intel.daysWaiting != null && intel.daysWaiting >= 7 && "text-amber-800",
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
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <span
          className={cn("tw-p", riskBadgeClass(intel.risk))}
          title={`${intel.businessStateLabel} · ${intel.reason}`}
        >
          {intel.riskLabel}
        </span>
      );
    },
  },
  {
    id: "next_action",
    label: "Next action",
    renderHeader: () => <>Next&nbsp;action</>,
    renderCell: (campaign) => {
      const intel = campaignPortfolioIntel(campaign);
      return (
        <Link
          href={campaignDetailPathWithTab(campaign, intel.nextActionTab)}
          className="tw-na2"
          title={`${intel.nextAction} · Owner: ${intel.owner} · ${intel.reason}`}
        >
          {intel.nextAction}
        </Link>
      );
    },
  },
  {
    id: "group_client",
    label: "Group · entity",
    renderHeader: () => <>Group&nbsp;·&nbsp;entity</>,
    renderCell: (campaign) => {
      const group = formatGroupDisplayName(campaign.group?.name);
      const entity =
        campaign.client?.legal_name || campaign.client?.name
          ? (campaign.client.legal_name ?? campaign.client.name)
          : null;
      const label = [group, entity].filter(Boolean).join(" · ");
      if (!label) {
        return <span className="tw-miss">not set</span>;
      }
      return (
        <span className="tw-hier" title={label}>
          {group ? <b>{group}</b> : null}
          {entity ? <u>{entity}</u> : null}
        </span>
      );
    },
  },
  {
    id: "lines",
    label: "Lines",
    renderHeader: () => <span className="tw-rr">Lines</span>,
    renderCell: (campaign) =>
      campaign.lines.length > 0 ? (
        <span
          className="tw-v tw-rr"
          title={campaign.lines
            .map((line) => formatDocumentNumberForDisplay(line.document_number))
            .join(", ")}
        >
          {campaign.lines.length}
        </span>
      ) : (
        <span className="tw-v tw-rr z">0</span>
      ),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (campaign) => (
      <span className={cn("tw-p", statusPillClass(campaign.status))} title={campaign.status}>
        {statusLabel(campaign.status)}
      </span>
    ),
  },
  {
    id: "client_link",
    label: "Client link",
    renderHeader: () => <>Client&nbsp;link</>,
    renderCell: (campaign) => (
      <span className="tw-lnk">
        <CampaignListClientLinkCell
          campaignHeaderId={campaign.id}
          link={campaign.client_workspace_link}
        />
      </span>
    ),
  },
  {
    id: "po_total",
    label: "PO total",
    renderHeader: () => <span className="tw-rr">PO&nbsp;total</span>,
    amountCell: true,
    renderCell: (campaign) => {
      const budget = campaignPoBudget(campaign);
      if (!(budget > 0)) {
        return <span className="tw-miss">no PO</span>;
      }
      const poAlertStatus = listPoAlertStatus(campaign);
      const currency = (campaign.currency_code || DEFAULT_PLATFORM_CURRENCY)
        .trim()
        .toUpperCase();
      const amount = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(budget);
      const title = `${currency} ${amount}`;
      const poLabel =
        poAlertStatus === "near_limit"
          ? "Near limit"
          : campaign.po_status && campaign.po_status !== "draft"
            ? PO_STATUS_LABELS[campaign.po_status]
            : null;
      return (
        <div className="tw-money">
          <span className="tw-money-row">
            <span
              className={cn(
                "tw-v",
                poAlertStatus === "exceeded" && "neg",
                poAlertStatus === "near_limit" && "text-amber-800"
              )}
              title={title}
            >
              {amount}
            </span>
            <span className="tw-cc">{currency}</span>
          </span>
          {poLabel ? (
            <span className={cn("tw-p", poPillClass(poAlertStatus, campaign.po_status))}>
              {poLabel}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "dates",
    label: "Dates",
    renderCell: datesCell,
  },
];

export const CAMPAIGNS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(
  CAMPAIGNS_TABLE_COLUMNS
);

function buildCols(visibleIds: readonly string[]): string {
  const tracks = visibleIds
    .map((id) => CAMPAIGNS_LIST_TRACKS[id])
    .filter(Boolean);
  return [SELECT_TRACK, ...tracks].join(" ");
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  const { visibleOrderedColumnIds, hydrated } = useOperationalTableColumnsContext();
  const dataContext = useOperationalTableDataContextOptional<CampaignListItem>();
  const displayRows = dataContext?.processedRows ?? campaigns;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const columnById = useMemo(
    () => new Map(CAMPAIGNS_TABLE_COLUMNS.map((column) => [column.id, column])),
    []
  );

  const visibleColumns = useMemo(() => {
    const ids = hydrated
      ? visibleOrderedColumnIds
      : CAMPAIGNS_TABLE_COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.id);
    return ids
      .map((id) => columnById.get(id))
      .filter((column): column is OperationalConfigurableColumnDef<CampaignListItem> =>
        Boolean(column)
      );
  }, [columnById, hydrated, visibleOrderedColumnIds]);

  const cols = useMemo(
    () => buildCols(visibleColumns.map((column) => column.id)),
    [visibleColumns]
  );

  const pageIds = displayRows.map((row) => row.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        pageIds.forEach((id) => next.add(id));
      } else {
        pageIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="tw-sc">
      <div style={{ minWidth: 1720 }}>
        <div
          className="tw-g tw-hr"
          style={{ "--cols": cols } as CSSProperties}
        >
          <span>
            <input
              type="checkbox"
              className="tw-ck"
              aria-label="Select all campaigns on this page"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
            />
          </span>
          {visibleColumns.map((column) => (
            <span key={column.id} title={column.label}>
              {column.renderHeader ? column.renderHeader() : column.label}
            </span>
          ))}
        </div>

        {displayRows.map((campaign) => {
          const intel = campaignPortfolioIntel(campaign);
          const isSelected = selected.has(campaign.id);
          const rowTone =
            intel.risk === "critical"
              ? "bad"
              : intel.risk === "elevated" ||
                  (intel.daysWaiting != null && intel.daysWaiting >= 7)
                ? "wrn"
                : isSelected
                  ? "sel"
                  : undefined;

          return (
            <div
              key={campaign.id}
              className={cn("tw-g tw-r", rowTone)}
              style={{ "--cols": cols } as CSSProperties}
            >
              <span>
                <input
                  type="checkbox"
                  className="tw-ck"
                  aria-label={`Select ${formatDocumentNumberForDisplay(campaign.document_number)}`}
                  checked={isSelected}
                  onChange={(event) => toggleOne(campaign.id, event.target.checked)}
                />
              </span>
              {visibleColumns.map((column) => (
                <span key={column.id} className={column.amountCell ? "tw-rr" : undefined}>
                  {column.renderCell(campaign)}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
