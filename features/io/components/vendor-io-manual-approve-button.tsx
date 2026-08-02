"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { recordVendorIoManualApprovalAction } from "@/features/io/record-vendor-io-manual-approval-action";
import type { VendorIoRow } from "@/features/io/types";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import {
  vendorIoAllowsAction,
  vendorIoRowToLifecycleSnapshot,
} from "@/lib/document-lifecycle";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  row: VendorIoRow;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "link";
  className?: string;
};

export function canRecordVendorIoManualApproval(row: VendorIoRow): boolean {
  return vendorIoAllowsAction(
    vendorIoRowToLifecycleSnapshot(row),
    "mark_accepted"
  );
}

export function VendorIoManualApproveButton({
  row,
  size = "sm",
  variant = "outline",
  className,
}: Props) {
  const [state, action, pending] = useActionState(
    recordVendorIoManualApprovalAction,
    INITIAL_STATE
  );
  const refresh = useRefreshCampaignAfterOperationalMutation();

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, refresh]);

  if (!canRecordVendorIoManualApproval(row)) {
    return null;
  }

  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
      <Button
        type="submit"
        size={size}
        variant={variant}
        disabled={pending}
        className={cn(className)}
        title="Record that the vendor approved this IO offline or after manual delivery"
      >
        {pending ? "Recording…" : "Record approval"}
      </Button>
    </form>
  );
}
