"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { creatorRejectVendorIoAction } from "@/features/portals/actions";

const INITIAL_STATE = { ok: false } as const;

export function CreatorRejectVendorIoForm({ vendorIoId }: { vendorIoId: string }) {
  const [state, action, pending] = useActionState(creatorRejectVendorIoAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="vendor_io_id" value={vendorIoId} />
      <Input
        name="approved_by_name"
        placeholder="Your name"
        className="h-8 w-[140px]"
        disabled={pending}
      />
      <Input
        name="rejection_reason"
        placeholder="Reason (optional)"
        className="h-8 w-[180px]"
        disabled={pending}
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Reject
      </Button>
    </form>
  );
}
