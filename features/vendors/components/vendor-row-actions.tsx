"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  ArchiveIcon,
  ArrowRightLeftIcon,
  CreditCardIcon,
  GitMergeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  archiveVendorAction,
  updateVendorStatusAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { VendorDependencyDialog } from "@/features/vendors/components/vendor-dependency-dialog";
import { VendorStatusBadge } from "@/features/vendors/components/vendor-status-badge";
import type { VendorListRow } from "@/features/vendors/types";

type VendorRowActionsProps = {
  vendor: VendorListRow;
};

export function VendorRowActions({ vendor }: VendorRowActionsProps) {
  const [depOpen, setDepOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveVendorAction,
    { ok: false } satisfies FormActionState
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateVendorStatusAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!archiveState.message) return;
    if (archiveState.ok) {
      toast.success(archiveState.message);
      setArchiveOpen(false);
      return;
    }
    toast.error(archiveState.message);
  }, [archiveState]);

  useEffect(() => {
    if (!statusState.message) return;
    if (statusState.ok) toast.success(statusState.message);
    else toast.error(statusState.message);
  }, [statusState]);

  const isArchived = vendor.status === "archived";
  const isActive = vendor.status === "active";
  const canArchive = !isArchived && vendor.assignment_count === 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={`Actions for ${vendor.display_name}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/vendors/${vendor.id}?tab=overview`}>
              <PencilIcon className="size-4" />
              Edit / open workspace
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/vendors/${vendor.id}?tab=assignments`}>
              View assignments
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/vendors/${vendor.id}?tab=billing`}>
              <CreditCardIcon className="size-4" />
              Payment history
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/operations/move?vendor=${vendor.id}`}>
              <ArrowRightLeftIcon className="size-4" />
              Reassign (Move)
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <GitMergeIcon className="size-4" />
            Merge (coming soon)
          </DropdownMenuItem>
          {!isArchived ? (
            <>
              <DropdownMenuSeparator />
              {isActive ? (
                <DropdownMenuItem asChild disabled={statusPending}>
                  <form action={statusAction} className="w-full">
                    <input type="hidden" name="vendor_id" value={vendor.id} />
                    <input type="hidden" name="status" value="inactive" />
                    <button type="submit" className="flex w-full items-center gap-2">
                      <PowerOffIcon className="size-4" />
                      Set inactive
                    </button>
                  </form>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild disabled={statusPending}>
                  <form action={statusAction} className="w-full">
                    <input type="hidden" name="vendor_id" value={vendor.id} />
                    <input type="hidden" name="status" value="active" />
                    <button type="submit" className="flex w-full items-center gap-2">
                      <PowerIcon className="size-4" />
                      Set active
                    </button>
                  </form>
                </DropdownMenuItem>
              )}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDepOpen(true)}>
            View dependencies
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!canArchive}
            onClick={() => setArchiveOpen(true)}
          >
            <ArchiveIcon className="size-4" />
            {vendor.assignment_count > 0
              ? "Archive blocked (assignments)"
              : "Archive vendor"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <VendorDependencyDialog
        vendorId={vendor.id}
        vendorName={vendor.display_name}
        open={depOpen}
        onOpenChange={setDepOpen}
        onArchive={canArchive ? () => setArchiveOpen(true) : undefined}
      />

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive vendor</DialogTitle>
            <DialogDescription>
              Archive {vendor.display_name}? Historical records are preserved.
              Active assignments must be reassigned first.
            </DialogDescription>
          </DialogHeader>
          <form action={archiveAction}>
            <input type="hidden" name="vendor_id" value={vendor.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setArchiveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function VendorStatusCell({
  vendor,
  badgeClassName,
}: {
  vendor: VendorListRow;
  badgeClassName?: string;
}) {
  return <VendorStatusBadge status={vendor.status} className={badgeClassName} />;
}
