"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { FinanceAdjustmentActionState } from "@/features/finance/adjustments/actions";
import {
  approveAdjustmentAction,
  cancelAdjustmentAction,
  postAdjustmentAction,
  reopenAdjustmentAction,
  unpostAdjustmentAction,
} from "@/features/finance/adjustments/lifecycle-actions";
import type { AdjustmentTableKind } from "@/lib/finance/adjustment-table-config";
import type { FinanceAdjustmentStatus } from "@/lib/finance/status/adjustment-status";

type AdjustmentLifecycleButtonsProps = {
  kind: AdjustmentTableKind;
  id: string;
  status: FinanceAdjustmentStatus;
};

function LifecycleForm({
  action,
  kind,
  id,
  label,
  variant = "outline",
}: {
  action: (
    prev: FinanceAdjustmentActionState,
    formData: FormData
  ) => Promise<FinanceAdjustmentActionState>;
  kind: AdjustmentTableKind;
  id: string;
  label: string;
  variant?: "outline" | "destructive" | "secondary";
}) {
  const [, formAction, pending] = useActionState(action, { ok: false });

  return (
    <form action={formAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant={variant} disabled={pending} className="h-7 text-[10px]">
        {pending ? "…" : label}
      </Button>
    </form>
  );
}

export function AdjustmentLifecycleButtons({ kind, id, status }: AdjustmentLifecycleButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {status === "draft" || status === "pending_repost" ? (
        <LifecycleForm action={approveAdjustmentAction} kind={kind} id={id} label="Approve" />
      ) : null}
      {status === "approved" ? (
        <LifecycleForm action={postAdjustmentAction} kind={kind} id={id} label="Post" />
      ) : null}
      {status === "posted" ? (
        <LifecycleForm action={unpostAdjustmentAction} kind={kind} id={id} label="Unpost" />
      ) : null}
      {status === "cancelled" ? (
        <LifecycleForm action={reopenAdjustmentAction} kind={kind} id={id} label="Reopen" />
      ) : null}
      {status !== "cancelled" && status !== "posted" ? (
        <LifecycleForm
          action={cancelAdjustmentAction}
          kind={kind}
          id={id}
          label="Cancel"
          variant="destructive"
        />
      ) : null}
    </div>
  );
}
