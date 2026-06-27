"use client";

import {
  ArchiveIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
} from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import {
  updateBrandStatusAction,
  type FormActionState,
} from "@/features/brands/actions";
import type { BrandTableRow } from "@/features/brands/utils";
import type { ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type BrandRowActionsProps = {
  brand: BrandTableRow;
  onEdit: () => void;
  onArchive: () => void;
  triggerClassName?: string;
};

export function BrandStatusCell({ status }: { status: ClientStatus }) {
  return <ClientStatusBadge status={status} />;
}

export function BrandDeactivateButton({
  brand,
  className,
}: {
  brand: BrandTableRow;
  className?: string;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateBrandStatusAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!statusState.message) return;
    if (statusState.ok) toast.success(statusState.message);
    else toast.error(statusState.message);
  }, [statusState]);

  if (brand.status === "archived" || brand.status === "prospect") {
    return null;
  }

  const nextStatus = brand.status === "active" ? "inactive" : "active";
  const label = brand.status === "active" ? "Deactivate" : "Activate";

  return (
    <form action={statusAction} className={cn("inline-flex", className)}>
      <input type="hidden" name="brand_id" value={brand.id} />
      <input type="hidden" name="client_id" value={brand.client_id} />
      <input type="hidden" name="status" value={nextStatus} />
      <button
        type="submit"
        className="platform-v6-btn platform-v6-btn-sm"
        disabled={statusPending}
      >
        {label}
      </button>
    </form>
  );
}

export function BrandRowActions({
  brand,
  onEdit,
  onArchive,
  triggerClassName,
}: BrandRowActionsProps) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateBrandStatusAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!statusState.message) return;
    if (statusState.ok) toast.success(statusState.message);
    else toast.error(statusState.message);
  }, [statusState]);

  const isArchived = brand.status === "archived";
  const isActive = brand.status === "active";
  const canArchive = !isArchived && brand.active_campaigns === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {triggerClassName ? (
          <button
            type="button"
            className={triggerClassName}
            aria-label={`Actions for ${brand.name}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={`Actions for ${brand.name}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon className="size-4" />
          Edit brand
        </DropdownMenuItem>

        {!isArchived ? (
          <>
            <DropdownMenuSeparator />
            {isActive ? (
              <DropdownMenuItem asChild disabled={statusPending}>
                <form action={statusAction} className="w-full">
                  <input type="hidden" name="brand_id" value={brand.id} />
                  <input type="hidden" name="client_id" value={brand.client_id} />
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
                  <input type="hidden" name="brand_id" value={brand.id} />
                  <input type="hidden" name="client_id" value={brand.client_id} />
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
        <DropdownMenuItem
          variant="destructive"
          disabled={!canArchive}
          onClick={onArchive}
        >
          <ArchiveIcon className="size-4" />
          {brand.active_campaigns > 0
            ? "Archive blocked (campaigns)"
            : "Archive brand"}
        </DropdownMenuItem>
        {isArchived ? (
          <DropdownMenuItem onClick={onEdit}>
            <PowerIcon className="size-4" />
            Restore via edit
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BrandStatusToggle({
  brand,
}: {
  brand: BrandTableRow;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateBrandStatusAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!statusState.message) return;
    if (statusState.ok) toast.success(statusState.message);
    else toast.error(statusState.message);
  }, [statusState]);

  if (brand.status === "archived" || brand.status === "prospect") {
    return <BrandStatusCell status={brand.status} />;
  }

  const nextStatus = brand.status === "active" ? "inactive" : "active";

  return (
    <form action={statusAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="brand_id" value={brand.id} />
      <input type="hidden" name="client_id" value={brand.client_id} />
      <input type="hidden" name="status" value={nextStatus} />
      <BrandStatusCell status={brand.status} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={statusPending}
        className="h-7 px-2 text-xs"
      >
        {brand.status === "active" ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}
