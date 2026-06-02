"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientApproveAction } from "@/features/portals/actions";

const INITIAL_STATE = { ok: false } as const;

export function ClientApprovalForm({
  entityType,
  entityId,
}: {
  entityType: "publication" | "deliverable" | "client_io";
  entityId: string;
}) {
  const [state, action, pending] = useActionState(clientApproveAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <Input
        name="approved_by_name"
        placeholder="Approved by name"
        className="h-8 w-[180px]"
        disabled={pending}
      />
      <Button type="submit" size="sm" name="decision" value="approved" disabled={pending}>
        Approve
      </Button>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        name="decision"
        value="rejected"
        disabled={pending}
      >
        Reject
      </Button>
    </form>
  );
}
