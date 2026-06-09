"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  CopyIcon,
  LockIcon,
  PencilIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  duplicateBudgetVersionAction,
  transitionBudgetVersionStatusAction,
} from "@/features/planning/actions";
import type { PlanningPermissions } from "@/features/planning/load-planning-workspace";
import { BUDGET_STATUS_LABELS } from "@/lib/planning/budgets/budget-status";
import type { BudgetVersion, BudgetVersionStatus } from "@/lib/planning/types/budget";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

type BudgetVersionsTableProps = {
  versions: BudgetVersion[];
  permissions: PlanningPermissions;
  selectedVersionId: string | null;
  onEdit: (version: BudgetVersion) => void;
  onCreateLine: (version: BudgetVersion) => void;
};

const STATUS_VARIANT: Record<
  BudgetVersionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  submitted: "outline",
  approved: "default",
  locked: "default",
  archived: "destructive",
};

function buildBudgetVersionColumns({
  permissions,
  isPending,
  onEdit,
  onCreateLine,
  runTransition,
  duplicate,
}: {
  permissions: PlanningPermissions;
  isPending: boolean;
  onEdit: (version: BudgetVersion) => void;
  onCreateLine: (version: BudgetVersion) => void;
  runTransition: (version: BudgetVersion, to: BudgetVersionStatus) => void;
  duplicate: (id: string) => void;
}): OperationalConfigurableColumnDef<BudgetVersion>[] {
  return [
    {
      id: "document",
      label: "Document",
      monoCell: true,
      renderCell: (version) => <DocumentNumber value={version.document_number} />,
    },
    {
      id: "name",
      label: "Name",
      cellClassName: "font-medium",
      renderCell: (version) => version.name,
    },
    {
      id: "fiscal_year",
      label: "FY",
      renderCell: (version) => version.fiscal_year,
    },
    {
      id: "status",
      label: "Status",
      renderCell: (version) => (
        <Badge variant={STATUS_VARIANT[version.status]}>
          {BUDGET_STATUS_LABELS[version.status]}
        </Badge>
      ),
    },
    {
      id: "currency",
      label: "Currency",
      renderCell: (version) => version.currency_code,
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "sticky right-0 z-10 min-w-[220px] bg-background text-right",
      cellClassName: "sticky right-0 z-10 bg-background",
      renderCell: (version) => {
        const canWrite = permissions.canWrite && version.status === "draft";
        const canApprove = permissions.canApprove;

        return (
          <div className="flex flex-wrap justify-end gap-1">
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => onEdit(version)}
              >
                <PencilIcon className="size-3.5" aria-hidden />
                <span className="sr-only">Edit</span>
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => onCreateLine(version)}
              >
                Line
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => duplicate(version.id)}
              >
                <CopyIcon className="size-3.5" aria-hidden />
              </Button>
            ) : null}
            {canApprove && version.status === "draft" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => runTransition(version, "submitted")}
              >
                <SendIcon className="size-3.5" aria-hidden />
                Submit
              </Button>
            ) : null}
            {canApprove && version.status === "submitted" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => runTransition(version, "approved")}
              >
                <CheckIcon className="size-3.5" aria-hidden />
                Approve
              </Button>
            ) : null}
            {canApprove && version.status === "approved" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => runTransition(version, "locked")}
              >
                <LockIcon className="size-3.5" aria-hidden />
                Lock
              </Button>
            ) : null}
            {canWrite && version.status !== "archived" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => runTransition(version, "archived")}
              >
                <ArchiveIcon className="size-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

export const PLANNING_BUDGET_VERSIONS_COLUMN_METAS = getOperationalTableColumnMetas(
  buildBudgetVersionColumns({
    permissions: { canRead: false, canWrite: false, canApprove: false, canForecast: false },
    isPending: false,
    onEdit: () => {},
    onCreateLine: () => {},
    runTransition: () => {},
    duplicate: () => {},
  })
);

export function BudgetVersionsTable({
  versions,
  permissions,
  selectedVersionId,
  onEdit,
  onCreateLine,
}: BudgetVersionsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticVersions, setOptimistic] = useOptimistic(
    versions,
    (current, patch: { id: string; status: BudgetVersionStatus }) =>
      current.map((v) => (v.id === patch.id ? { ...v, status: patch.status } : v))
  );

  const runTransition = (version: BudgetVersion, to: BudgetVersionStatus) => {
    startTransition(async () => {
      setOptimistic({ id: version.id, status: to });
      const result = await transitionBudgetVersionStatusAction({
        id: version.id,
        from: version.status,
        to,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Version ${BUDGET_STATUS_LABELS[to].toLowerCase()}.`);
    });
  };

  const duplicate = (id: string) => {
    startTransition(async () => {
      const result = await duplicateBudgetVersionAction(id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Budget duplicated as draft.");
    });
  };

  const columns = useMemo(
    () =>
      buildBudgetVersionColumns({
        permissions,
        isPending,
        onEdit,
        onCreateLine,
        runTransition,
        duplicate,
      }),
    [permissions, isPending, onEdit, onCreateLine]
  );

  if (optimisticVersions.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No budget versions for this fiscal year. Create one to start planning.
      </p>
    );
  }

  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.planningBudgetVersions}
      columns={columns}
      rows={optimisticVersions}
      filterAccessors={{
        document: (row) => row.document_number,
        name: (row) => row.name,
        fiscal_year: (row) => row.fiscal_year,
        status: (row) => row.status,
        currency: (row) => row.currency_code,
      }}
    >
      <div className="space-y-2">
        <div className="flex justify-end">
          <OperationalTableControlsSlot contextLabel="Budget versions" />
        </div>
        <OperationalConfigurableTable
          columns={columns}
          rows={optimisticVersions}
          rowKey={(version) => version.id}
          rowClassName={(version) =>
            cn(version.id === selectedVersionId && "bg-muted/40")
          }
        />
      </div>
    </OperationalTableSuiteProvider>
  );
}
