"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendVendorIoAction } from "@/features/io/actions";
import type { VendorIoRow } from "@/features/io/types";
import {
  vendorIoAllowsAction,
  vendorIoRowToLifecycleSnapshot,
} from "@/lib/document-lifecycle";
import { hasValidVendorEmail } from "@/lib/io/vendor-io-delivery";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type VendorIoSendButtonProps = {
  row: VendorIoRow;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "link";
  className?: string;
};

export function VendorIoSendButton({
  row,
  size = "sm",
  variant = "default",
  className,
}: VendorIoSendButtonProps) {
  const [state, action, pending] = useActionState(sendVendorIoAction, INITIAL_STATE);
  const canEmail = hasValidVendorEmail(row.influencer_email);
  const snapshot = vendorIoRowToLifecycleSnapshot(row);
  const canSend = vendorIoAllowsAction(snapshot, "send");
  const canManual = vendorIoAllowsAction(snapshot, "mark_delivered_manually");
  const canResend = vendorIoAllowsAction(snapshot, "resend");

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  // Document Lifecycle Engine owns visibility — completed actions disappear.
  if (!canSend && !canManual && !canResend) {
    return null;
  }

  const idleLabel = canResend && !canSend
    ? "Resend"
    : canEmail
      ? "Send by Email"
      : "Mark as Delivered Manually";
  const pendingLabel = canEmail || canResend ? "Sending…" : "Marking…";

  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
      <Button
        type="submit"
        size={size}
        variant={variant}
        disabled={pending}
        className={cn(variant === "link" && "thinkway-campaign-link-btn", className)}
      >
        {pending ? pendingLabel : idleLabel}
      </Button>
    </form>
  );
}
