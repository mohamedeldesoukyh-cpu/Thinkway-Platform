"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendVendorIoAction } from "@/features/io/actions";
import type { VendorIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

type VendorIoSendButtonProps = {
  row: VendorIoRow;
  size?: "sm" | "default";
  variant?: "default" | "outline";
};

export function VendorIoSendButton({
  row,
  size = "sm",
  variant = "default",
}: VendorIoSendButtonProps) {
  const [state, action, pending] = useActionState(sendVendorIoAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
      <Button type="submit" size={size} variant={variant} disabled={pending}>
        {pending ? "Sending…" : row.status === "sent" ? "Resend" : "Send"}
      </Button>
    </form>
  );
}
