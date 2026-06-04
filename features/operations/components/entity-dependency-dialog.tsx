"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { AlertTriangleIcon, ArchiveIcon, ArrowRightLeftIcon } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEntityDependenciesAction } from "@/features/operations/actions";
import type { EntityType } from "@/lib/operations/entity-dependencies";
import { formatBillingMoney } from "@/features/billing/utils";

type EntityDependencyDialogProps = {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: () => void;
};

export function EntityDependencyDialog({
  entityType,
  entityId,
  entityName,
  open,
  onOpenChange,
  onArchive,
}: EntityDependencyDialogProps) {
  const [state, formAction, pending] = useActionState(getEntityDependenciesAction, {
    ok: false,
  });

  useEffect(() => {
    if (!open) return;
    const fd = new FormData();
    fd.set("entity_type", entityType);
    fd.set("entity_id", entityId);
    formAction(fd);
  }, [open, entityType, entityId, formAction]);

  const deps = state.dependencies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-500" />
            Cannot delete — linked activity
          </DialogTitle>
          <DialogDescription>
            {entityName} has historical transactions. Reassign or archive instead of permanent delete.
          </DialogDescription>
        </DialogHeader>

        {pending && !deps ? (
          <p className="text-sm text-muted-foreground">Checking dependencies…</p>
        ) : deps ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Campaigns", deps.campaigns],
                ["Invoices", deps.invoices],
                ["Collections", deps.collections],
                ["Approvals", deps.approvals],
                ["Billing lines", deps.billing_lines],
                ["Audit records", deps.audit_records],
              ].map(([label, count]) => (
                <div key={label as string} className="rounded-2xl border p-3">
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <p className="text-xl font-semibold">{count as number}</p>
                </div>
              ))}
            </div>

            {deps.linked_campaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">GP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deps.linked_campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{c.name}</span>
                            <p className="text-xs text-muted-foreground">
                              <DocumentNumber value={c.document_number} />
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{c.status}</TableCell>
                        <TableCell className="text-right">
                          {formatBillingMoney(c.revenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBillingMoney(c.gp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" asChild>
            <Link href="/operations/move">
              <ArrowRightLeftIcon className="size-4" />
              Move transactions
            </Link>
          </Button>
          {onArchive ? (
            <Button variant="secondary" onClick={onArchive}>
              <ArchiveIcon className="size-4" />
              Archive entity
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
