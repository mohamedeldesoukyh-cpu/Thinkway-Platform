"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { AlertTriangleIcon, ArchiveIcon, ArrowRightLeftIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VENDOR_ASSIGNMENT_DEPS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVendorDependenciesAction } from "@/features/vendors/actions";
import { formatMoney } from "@/features/vendors/utils";
import type { VendorLinkedAssignment } from "@/lib/operations/vendor-dependencies";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

const VENDOR_ASSIGNMENT_DEPS_COLUMNS: OperationalConfigurableColumnDef<VendorLinkedAssignment>[] =
  [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (assignment) => (
        <div>
          <span className="font-medium">{assignment.campaign_name}</span>
          <p className="text-xs text-muted-foreground">
            <DocumentNumber value={assignment.campaign_document_number} />
          </p>
        </div>
      ),
    },
    {
      id: "line",
      label: "Line",
      cellClassName: "text-xs",
      monoCell: true,
      renderCell: (assignment) => <DocumentNumber value={assignment.line_document_number} />,
    },
    {
      id: "billing",
      label: "Billing",
      cellClassName: "capitalize",
      renderCell: (assignment) => assignment.billing_status?.replace(/_/g, " ") ?? "—",
    },
    {
      id: "fee",
      label: "Fee",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (assignment) => formatMoney(assignment.agreed_fee, assignment.currency),
    },
  ];

const VENDOR_ASSIGNMENT_DEPS_COLUMN_METAS = getOperationalTableColumnMetas(
  VENDOR_ASSIGNMENT_DEPS_COLUMNS
);

type VendorDependencyDialogProps = {
  vendorId: string;
  vendorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: () => void;
};

export function VendorDependencyDialog({
  vendorId,
  vendorName,
  open,
  onOpenChange,
  onArchive,
}: VendorDependencyDialogProps) {
  const [state, formAction, pending] = useActionState(getVendorDependenciesAction, {
    ok: false,
  });

  useEffect(() => {
    if (!open) return;
    const fd = new FormData();
    fd.set("vendor_id", vendorId);
    formAction(fd);
  }, [open, vendorId, formAction]);

  const deps = state.dependencies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-500" />
            Operational dependencies
          </DialogTitle>
          <DialogDescription>
            {vendorName} — assignments, billing, and audit linkage before archive or delete.
          </DialogDescription>
        </DialogHeader>

        {pending && !deps ? (
          <p className="text-sm text-muted-foreground">Checking dependencies…</p>
        ) : deps ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Assignments", deps.assignments],
                ["Campaigns", deps.campaigns],
                ["Deliverables", deps.deliverables],
                ["Invoices", deps.invoices],
                ["Billing lines", deps.billing_lines],
                ["Payments", deps.payments],
                ["Collections", deps.collections],
                ["Approvals", deps.approvals],
                ["Audit records", deps.audit_records],
              ].map(([label, count]) => (
                <div key={label as string} className="rounded-2xl border p-3">
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <p className="text-xl font-semibold">{count as number}</p>
                </div>
              ))}
            </div>

            {deps.linked_assignments.length > 0 ? (
              <OperationalTableSuiteProvider
                tableId={OPERATIONAL_TABLE_IDS.dialogVendorAssignmentDeps}
                columns={VENDOR_ASSIGNMENT_DEPS_COLUMNS}
                rows={deps.linked_assignments}
                filterAccessors={VENDOR_ASSIGNMENT_DEPS_FILTER_ACCESSORS}
              >
                <div className="flex justify-end pb-2">
                  <OperationalTableControlsSlot contextLabel="Linked assignments" />
                </div>
                <OperationalConfigurableTable
                  columns={VENDOR_ASSIGNMENT_DEPS_COLUMNS}
                  rows={deps.linked_assignments}
                  rowKey={(assignment) => assignment.id}
                />
              </OperationalTableSuiteProvider>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {deps.can_permanently_delete
                ? "No operational linkage — permanent delete may be allowed."
                : "Hard delete blocked — reassign or archive instead."}
            </p>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/operations/move?vendor=${vendorId}`}>
              <ArrowRightLeftIcon className="size-4" />
              Reassign via Move
            </Link>
          </Button>
          {onArchive && deps?.can_archive ? (
            <Button variant="secondary" onClick={onArchive}>
              <ArchiveIcon className="size-4" />
              Archive vendor
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
