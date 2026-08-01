"use client";

import { useCallback, useMemo, useState } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { Checkbox } from "@/components/ui/checkbox";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { VendorIoDetailSheet } from "@/features/io/components/vendor-io-detail-sheet";
import { VendorIoHeaderSend } from "@/features/io/components/vendor-io-header-send";
import { VendorIoInfluencerCell } from "@/features/io/components/vendor-io-influencer-cell";
import { VendorIoRowContextMenu } from "@/features/io/components/vendor-io-row-context-menu";
import {
  VendorIoSelectionFlyout,
  vendorIoFloatingBarContentClass,
} from "@/features/io/components/vendor-io-selection-flyout";
import { VendorIoDeliveryBadge } from "@/features/io/components/vendor-io-delivery-badge";
import { VendorIoRowActions } from "@/features/io/components/vendor-io-row-actions";
import { VendorIoSpecialPaymentTermsCell } from "@/features/io/components/vendor-io-special-payment-terms-cell";
import { VendorIoStatusPill } from "@/features/io/components/vendor-io-status-pill";
import type { VendorIoRow } from "@/features/io/types";
import {
  AuroraStatusPill,
  CampaignWorkspaceFrame,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import { formatMoney } from "@/features/campaigns/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

const SELECT_COLUMN_ID = "select";

type Props = {
  campaignId: string;
  rows: VendorIoRow[];
};

type VendorIoSelectionHandlers = {
  selectedIds: Set<string>;
  visibleIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
};

function formatSentApproved(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildVendorIoSelectColumn(
  handlers: VendorIoSelectionHandlers
): OperationalConfigurableColumnDef<VendorIoRow> {
  const { selectedIds, visibleIds, onToggleSelect, onToggleSelectAll } = handlers;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  return {
    id: SELECT_COLUMN_ID,
    label: "Select",
    locked: true,
    colWidth: "40px",
    headerClassName: "w-10 px-2",
    cellClassName: "w-10 px-2",
    renderHeader: () => (
      <div className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
          onCheckedChange={() => onToggleSelectAll(visibleIds)}
          aria-label="Select all visible vendor IOs"
        />
      </div>
    ),
    renderCell: (row) => (
      <div className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={selectedIds.has(row.id)}
          onCheckedChange={() => onToggleSelect(row.id)}
          aria-label={`Select ${row.document_number ?? row.influencer_name ?? "vendor IO"}`}
        />
      </div>
    ),
  };
}

function buildCampaignVendorIoColumns(
  onViewDetail: (ioId: string) => void
): OperationalConfigurableColumnDef<VendorIoRow>[] {
  return [
    {
      id: "io_number",
      label: "IO #",
      colWidth: "10%",
      cellClassName: "truncate",
      renderCell: (row) => (
        <button
          type="button"
          className="thinkway-campaign-link-btn max-w-full truncate"
          onClick={() => onViewDetail(row.id)}
          title={`View ${row.document_number ?? "vendor IO"} details`}
        >
          {row.document_number ?? "—"}
        </button>
      ),
    },
    {
      id: "assignment",
      label: "Assignment",
      defaultVisible: false,
      colWidth: "9%",
      cellClassName: "truncate",
      renderCell: (row) => (
        <span className="thinkway-campaign-link block max-w-full cursor-default truncate">
          {row.assignment_document_number ?? "—"}
        </span>
      ),
    },
    {
      id: "influencer",
      label: "Influencer",
      colWidth: "16%",
      cellClassName: "min-w-0",
      renderCell: (row) => (
        <VendorIoInfluencerCell
          name={row.influencer_name}
          avatarUrl={row.creator_avatar_url}
        />
      ),
    },
    {
      id: "amount",
      label: "Amount",
      colWidth: "8%",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      renderCell: (row) => (
        <span className="thinkway-campaign-num">{formatOperationalAmount(row.amount)}</span>
      ),
    },
    {
      id: "status",
      label: "Status",
      colWidth: "12%",
      renderCell: (row) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <VendorIoStatusPill status={row.status} />
          <VendorIoDeliveryBadge
            deliveryMethod={row.delivery_method}
            deliveryStatus={row.delivery_status}
          />
        </div>
      ),
    },
    {
      id: "current_payment_terms",
      label: "Payment terms",
      colWidth: "12%",
      cellClassName: "whitespace-normal break-words align-top",
      renderCell: (row) => (
        <span className="thinkway-campaign-cell-muted block whitespace-normal break-words leading-snug">
          {row.vendor_payment_terms_label || "—"}
        </span>
      ),
    },
    {
      id: "special_payment_terms",
      label: "Special terms",
      colWidth: "14%",
      cellClassName: "whitespace-normal break-words align-top",
      renderCell: (row) => <VendorIoSpecialPaymentTermsCell row={row} />,
    },
    {
      id: "sent",
      label: "Sent",
      defaultVisible: false,
      colWidth: "8%",
      cellClassName: "truncate",
      renderCell: (row) => (
        <span className={cn("truncate", !row.sent_at && "thinkway-campaign-c-gray")}>
          {formatSentApproved(row.sent_at)}
        </span>
      ),
    },
    {
      id: "approved",
      label: "Approved",
      colWidth: "8%",
      cellClassName: "truncate",
      renderCell: (row) => (
        <span className={cn("truncate", !row.approved_at && "thinkway-campaign-c-gray")}>
          {formatSentApproved(row.approved_at)}
        </span>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      colWidth: "12%",
      headerClassName: "text-right",
      cellClassName: "text-right align-middle",
      renderCell: (row) => (
        <VendorIoRowActions row={row} onViewDetail={onViewDetail} />
      ),
    },
  ];
}

const CAMPAIGN_VENDOR_IO_BASE_COLUMNS = buildCampaignVendorIoColumns(() => {});

const CAMPAIGN_VENDOR_IO_TABLE_COLUMNS: OperationalConfigurableColumnDef<VendorIoRow>[] = [
  buildVendorIoSelectColumn({
    selectedIds: new Set(),
    visibleIds: [],
    onToggleSelect: () => {},
    onToggleSelectAll: () => {},
  }),
  ...CAMPAIGN_VENDOR_IO_BASE_COLUMNS,
];

export const CAMPAIGN_VENDOR_IO_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(
  CAMPAIGN_VENDOR_IO_TABLE_COLUMNS
);

type VendorIoTableBodyProps = {
  campaignId: string;
  sorted: VendorIoRow[];
  selectedIds: Set<string>;
  selectedRows: VendorIoRow[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  setDetailIoId: (ioId: string) => void;
};

function VendorIoTableBody({
  campaignId,
  sorted,
  selectedIds,
  selectedRows,
  onToggleSelect,
  onToggleSelectAll,
  onSelectAll,
  onClearSelection,
  setDetailIoId,
}: VendorIoTableBodyProps) {
  const dataContext = useOperationalTableDataContextOptional<VendorIoRow>();
  const visibleRows = dataContext?.processedRows ?? sorted;
  const visibleIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);

  const onSelectAllVisible = useCallback(() => {
    onSelectAll(visibleIds);
  }, [onSelectAll, visibleIds]);

  const columns = useMemo(
    () => [
      buildVendorIoSelectColumn({
        selectedIds,
        visibleIds,
        onToggleSelect,
        onToggleSelectAll,
      }),
      ...buildCampaignVendorIoColumns(setDetailIoId),
    ],
    [selectedIds, visibleIds, onToggleSelect, onToggleSelectAll, setDetailIoId]
  );

  if (sorted.length === 0) {
    return (
      <div className="thinkway-campaign-empty-state">
        <p>No assignment IO drafts generated yet.</p>
      </div>
    );
  }

  return (
    <>
      <OperationalConfigurableTable
        columns={columns}
        rows={sorted}
        rowKey={(row) => row.id}
        rowClassName={(row) => cn(selectedIds.has(row.id) && "bg-primary/5")}
        wrapRow={(row, rowElement) => (
          <VendorIoRowContextMenu row={row}>{rowElement}</VendorIoRowContextMenu>
        )}
      />
      <VendorIoSelectionFlyout
        campaignId={campaignId}
        selectedRows={selectedRows}
        selectableCount={visibleIds.length}
        onSelectAll={onSelectAllVisible}
        onClearSelection={onClearSelection}
      />
    </>
  );
}

export function VendorIoTab({ campaignId, rows }: Props) {
  const [detailIoId, setDetailIoId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [rows]
  );

  const detailRow = useMemo(
    () => (detailIoId ? (sorted.find((row) => row.id === detailIoId) ?? null) : null),
    [detailIoId, sorted]
  );

  const providerColumns = useMemo(() => CAMPAIGN_VENDOR_IO_TABLE_COLUMNS, []);

  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onToggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const onSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const onClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;
  const selectedRows = useMemo(
    () => sorted.filter((row) => selectedIds.has(row.id)),
    [sorted, selectedIds]
  );

  const summary = useMemo(() => {
    const sent = sorted.filter(
      (row) => row.status === "sent" || row.delivery_status === "sent"
    ).length;
    const approved = sorted.filter((row) => row.status === "approved").length;
    const generated = sorted.filter(
      (row) => row.status === "generated" || row.status === "draft"
    ).length;
    const totalAmount = sorted.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const currency = sorted[0]?.currency_code ?? "EGP";
    return { sent, approved, generated, totalAmount, currency };
  }, [sorted]);

  return (
    <>
      <CampaignWorkspaceFrame
        title="Vendor IO"
        subtitle="Creator insertion orders — send, track delivery, and record approvals"
        status={
          <AuroraStatusPill
            tone={
              summary.approved > 0 ? "green" : summary.sent > 0 ? "blue" : "mut"
            }
          >
            {summary.sent} sent · {summary.approved} approved
          </AuroraStatusPill>
        }
        stats={[
          { key: "total", label: "Orders", value: String(sorted.length) },
          { key: "generated", label: "Draft / generated", value: String(summary.generated) },
          { key: "sent", label: "Sent", value: String(summary.sent), tone: "blue" },
          {
            key: "approved",
            label: "Approved",
            value: String(summary.approved),
            tone: "pos",
          },
          {
            key: "amount",
            label: "Total amount",
            value: formatMoney(summary.totalAmount, summary.currency),
            tone: "blue",
          },
          {
            key: "selected",
            label: "Selected",
            value: String(selectedCount),
            tone: selectedCount > 0 ? "amber" : "mut",
          },
        ]}
        registerLabel="Document register"
      >
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.campaignVendorIos}
        columns={providerColumns}
        rows={sorted}
        filterAccessors={{
          io_number: (row) => row.document_number,
          assignment: (row) => row.assignment_document_number,
          influencer: (row) => row.influencer_name,
          amount: (row) => row.amount,
          status: (row) => row.status,
          sent: (row) => row.sent_at,
          approved: (row) => row.approved_at,
        }}
      >
        <div
          className={cn(
            "thinkway-campaign-vendor-io-fill",
            vendorIoFloatingBarContentClass(selectedCount > 0)
          )}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            fillHeight
            leading={
              <CampaignOperationalSectionHeader
                title="Orders"
                description="Select one or more rows to send. Each row also has Send in Actions."
                actions={
                  <>
                    <VendorIoHeaderSend
                      selectedRows={selectedRows}
                      onClearSelection={onClearSelection}
                    />
                    <OperationalTableControlsSlot contextLabel="Vendor IO" />
                  </>
                }
              />
            }
          >
            <VendorIoTableBody
              campaignId={campaignId}
              sorted={sorted}
              selectedIds={selectedIds}
              selectedRows={selectedRows}
              onToggleSelect={onToggleSelect}
              onToggleSelectAll={onToggleSelectAll}
              onSelectAll={onSelectAll}
              onClearSelection={onClearSelection}
              setDetailIoId={setDetailIoId}
            />
          </OperationalTableSection>
        </div>
      </OperationalTableSuiteProvider>
      </CampaignWorkspaceFrame>

      <VendorIoDetailSheet
        open={detailIoId != null}
        onOpenChange={(open) => {
          if (!open) setDetailIoId(null);
        }}
        row={detailRow}
        campaignId={campaignId}
      />
    </>
  );
}
