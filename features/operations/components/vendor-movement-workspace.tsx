"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import { OPERATIONS_VENDOR_MOVE_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { Label } from "@/components/ui/label";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { Textarea } from "@/components/ui/textarea";
import { executeVendorMovementAction } from "@/features/operations/actions";
import type {
  HierarchyOption,
  VendorMovementAssignmentRow,
} from "@/features/operations/types";
import { formatBillingMoney } from "@/features/billing/utils";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

export const OPERATIONS_VENDOR_MOVE_ASSIGNMENTS_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "select", label: "Select", locked: true },
  { id: "campaign", label: "Campaign" },
  { id: "line", label: "Line" },
  { id: "billing", label: "Billing" },
  { id: "revenue", label: "Revenue" },
  { id: "payout", label: "Payout" },
];

type VendorMovementWorkspaceProps = {
  vendors: HierarchyOption[];
  initialSourceVendorId?: string;
  initialAssignments: VendorMovementAssignmentRow[];
};

function VendorMoveAssignmentsTableHeader({
  allSelected,
  onToggleAll,
}: {
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
}) {
  const showSelect = useIsOperationalColumnVisible("select");
  const showCampaign = useIsOperationalColumnVisible("campaign");
  const showLine = useIsOperationalColumnVisible("line");
  const showBilling = useIsOperationalColumnVisible("billing");
  const showRevenue = useIsOperationalColumnVisible("revenue");
  const showPayout = useIsOperationalColumnVisible("payout");

  return (
    <CampaignOperationalTableHeader>
      <CampaignOperationalTableHeaderRow>
        {showSelect ? (
          <CampaignOperationalTableHead className="w-10">
            <input
              type="checkbox"
              className="size-4 rounded border"
              checked={allSelected}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
          </CampaignOperationalTableHead>
        ) : null}
        {showCampaign ? (
          <CampaignOperationalTableHead>Campaign</CampaignOperationalTableHead>
        ) : null}
        {showLine ? <CampaignOperationalTableHead>Line</CampaignOperationalTableHead> : null}
        {showBilling ? (
          <CampaignOperationalTableHead>Billing</CampaignOperationalTableHead>
        ) : null}
        {showRevenue ? (
          <CampaignOperationalTableHead className="text-right">Revenue</CampaignOperationalTableHead>
        ) : null}
        {showPayout ? (
          <CampaignOperationalTableHead>Payout</CampaignOperationalTableHead>
        ) : null}
      </CampaignOperationalTableHeaderRow>
    </CampaignOperationalTableHeader>
  );
}

function VendorMoveAssignmentsTableRow({
  assignment,
  selected,
  onToggle,
}: {
  assignment: VendorMovementAssignmentRow;
  selected: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const showSelect = useIsOperationalColumnVisible("select");
  const showCampaign = useIsOperationalColumnVisible("campaign");
  const showLine = useIsOperationalColumnVisible("line");
  const showBilling = useIsOperationalColumnVisible("billing");
  const showRevenue = useIsOperationalColumnVisible("revenue");
  const showPayout = useIsOperationalColumnVisible("payout");

  return (
    <CampaignOperationalTableRow>
      {showSelect ? (
        <CampaignOperationalTableCell>
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={selected}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </CampaignOperationalTableCell>
      ) : null}
      {showCampaign ? (
        <CampaignOperationalTableCell>
          <div>
            <span className="font-medium">{assignment.campaign_name}</span>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              <DocumentNumber value={assignment.campaign_document_number} />
            </p>
          </div>
        </CampaignOperationalTableCell>
      ) : null}
      {showLine ? (
        <CampaignOperationalTableCellMono>
          <DocumentNumber value={assignment.line_document_number} />
        </CampaignOperationalTableCellMono>
      ) : null}
      {showBilling ? (
        <CampaignOperationalTableCell className="capitalize">
          {assignment.billing_status?.replace(/_/g, " ") ?? "—"}
        </CampaignOperationalTableCell>
      ) : null}
      {showRevenue ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoney(assignment.revenue)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showPayout ? (
        <CampaignOperationalTableCell className="capitalize">
          {assignment.vendor_payment_status ?? "—"}
        </CampaignOperationalTableCell>
      ) : null}
    </CampaignOperationalTableRow>
  );
}

function VendorMoveAssignmentsTable({
  rows,
  selected,
  onToggleAll,
  onToggleOne,
}: {
  rows: VendorMovementAssignmentRow[];
  selected: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
}) {
  const displayRows =
    useOperationalTableDataContextOptional<VendorMovementAssignmentRow>()?.processedRows ??
    rows;

  return (
    <CampaignOperationalTable>
      <VendorMoveAssignmentsTableHeader
        allSelected={displayRows.length > 0 && selected.size === displayRows.length}
        onToggleAll={onToggleAll}
      />
      <CampaignOperationalTableBody>
        {displayRows.map((assignment) => (
          <VendorMoveAssignmentsTableRow
            key={assignment.id}
            assignment={assignment}
            selected={selected.has(assignment.id)}
            onToggle={(checked) => onToggleOne(assignment.id, checked)}
          />
        ))}
      </CampaignOperationalTableBody>
    </CampaignOperationalTable>
  );
}

export function VendorMovementWorkspace({
  vendors,
  initialSourceVendorId = "",
  initialAssignments,
}: VendorMovementWorkspaceProps) {
  const [sourceVendorId, setSourceVendorId] = useState(initialSourceVendorId);
  const [destVendorId, setDestVendorId] = useState("");
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const vendorOptions = vendors.map((v) => ({
    value: v.id,
    label: v.sublabel ? `${v.label} (${v.sublabel})` : v.label,
  }));

  const destOptions = vendorOptions.filter((v) => v.value !== sourceVendorId);

  useEffect(() => {
    if (!sourceVendorId) {
      setAssignments([]);
      setSelected(new Set());
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/operations/vendors/${sourceVendorId}/assignments`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        assignments?: VendorMovementAssignmentRow[];
      };
      setAssignments(data.assignments ?? []);
      setSelected(new Set());
    });
  }, [sourceVendorId]);

  const selectedRows = assignments.filter((a) => selected.has(a.id));
  const selectedRevenue = selectedRows.reduce((s, a) => s + a.revenue, 0);

  const toggleAll = (checked: boolean) => {
    setSelected(
      checked ? new Set(assignments.map((a) => a.id)) : new Set()
    );
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onExecute = () => {
    if (!sourceVendorId || !destVendorId || selected.size === 0) {
      toast.error("Select source, destination, and at least one assignment.");
      return;
    }
    const fd = new FormData();
    fd.set("movement_type", "vendor_to_vendor");
    fd.set("source_influencer_id", sourceVendorId);
    fd.set("destination_influencer_id", destVendorId);
    fd.set("assignment_ids", [...selected].join(","));
    fd.set("reason", reason);

    startTransition(async () => {
      const result = await executeVendorMovementAction({ ok: false }, fd);
      if (result.ok) {
        toast.success(result.message);
        setSelected(new Set());
        setReason("");
      } else {
        toast.error(result.message ?? "Movement failed.");
      }
    });
  };

  const filtered = useMemo(() => assignments, [assignments]);
  const suiteColumns = useMemo(
    () =>
      operationalColumnsFromMetas(
        OPERATIONS_VENDOR_MOVE_ASSIGNMENTS_COLUMN_METAS,
        OPERATIONS_VENDOR_MOVE_FILTER_ACCESSORS
      ),
    []
  );

  return (
    <div className="space-y-4">
      <CampaignFlatSection
        title="Vendor → Vendor reassignment"
        description="Transfer campaign assignments between creators. Preserves campaign numbering, invoice linkage, audit history, and payment records."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Source vendor</Label>
            <SearchableSelect
              value={sourceVendorId}
              onValueChange={setSourceVendorId}
              options={vendorOptions}
              placeholder="Select source creator"
            />
          </div>
          <div className="grid gap-2">
            <Label>Destination vendor</Label>
            <SearchableSelect
              value={destVendorId}
              onValueChange={setDestVendorId}
              options={destOptions}
              placeholder="Select destination creator"
              disabled={!sourceVendorId}
            />
          </div>
        </div>
      </CampaignFlatSection>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.operationsVendorMoveAssignments}
        columns={suiteColumns}
        rows={filtered}
        filterAccessors={OPERATIONS_VENDOR_MOVE_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Assignments to move"
              actions={<OperationalTableControlsSlot contextLabel="Vendor move assignments" />}
            />
          }
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              Select a source vendor to load assignments.
            </p>
          ) : (
            <VendorMoveAssignmentsTable
              rows={filtered}
              selected={selected}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <OperationalFormSection
        title="Execute reassignment"
        footer={
          <Button
            onClick={onExecute}
            disabled={
              isPending ||
              !sourceVendorId ||
              !destVendorId ||
              selected.size === 0 ||
              reason.trim().length < 3
            }
          >
            {isPending ? "Executing…" : "Execute vendor reassignment"}
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Selected: {selected.size} assignment(s) ·{" "}
          {formatBillingMoney(selectedRevenue)} revenue
        </p>
        <div className="grid gap-2">
          <Label htmlFor="vendor_move_reason">Reason *</Label>
          <Textarea
            id="vendor_move_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Operational reason for reassignment (min 3 characters)"
            rows={3}
            className="min-h-[4.5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"
          />
        </div>
      </OperationalFormSection>
    </div>
  );
}
