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
import { getVendorDependenciesAction } from "@/features/vendors/actions";
import { formatMoney } from "@/features/vendors/utils";

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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deps.linked_assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{a.campaign_name}</span>
                            <p className="text-xs text-muted-foreground">
                              <DocumentNumber value={a.campaign_document_number} />
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <DocumentNumber value={a.line_document_number} />
                        </TableCell>
                        <TableCell className="capitalize">
                          {a.billing_status?.replace(/_/g, " ") ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(a.agreed_fee, a.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
