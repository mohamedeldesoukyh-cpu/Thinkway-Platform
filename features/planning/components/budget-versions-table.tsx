"use client";

import { useOptimistic, useTransition } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  CopyIcon,
  LockIcon,
  PencilIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  duplicateBudgetVersionAction,
  transitionBudgetVersionStatusAction,
} from "@/features/planning/actions";
import type { PlanningPermissions } from "@/features/planning/load-planning-workspace";
import { BUDGET_STATUS_LABELS } from "@/lib/planning/budgets/budget-status";
import type { BudgetVersion, BudgetVersionStatus } from "@/lib/planning/types/budget";
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

  if (optimisticVersions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No budget versions for this fiscal year. Create one to start planning.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>FY</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead className="sticky right-0 z-10 min-w-[220px] bg-background text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {optimisticVersions.map((version) => {
            const canWrite = permissions.canWrite && version.status === "draft";
            const canApprove = permissions.canApprove;
            const isSelected = version.id === selectedVersionId;

            return (
              <TableRow
                key={version.id}
                className={cn(isSelected && "bg-muted/40")}
              >
                <TableCell className="text-xs">
                  <DocumentNumber value={version.document_number} />
                </TableCell>
                <TableCell className="font-medium">{version.name}</TableCell>
                <TableCell>{version.fiscal_year}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[version.status]}>
                    {BUDGET_STATUS_LABELS[version.status]}
                  </Badge>
                </TableCell>
                <TableCell>{version.currency_code}</TableCell>
                <TableCell className="sticky right-0 z-10 bg-background">
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
