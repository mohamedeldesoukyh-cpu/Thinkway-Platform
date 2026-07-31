"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendClientIoAction } from "@/features/io/actions";
import { OPERATIONAL_CHROME_LABEL } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import type { ClientIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type ClientIoSendControlsProps = {
  io: ClientIoRow;
  campaignId: string;
  sendRecipientsJson: string;
  recipientCount: number;
  hasDocument: boolean;
  compact?: boolean;
  buttonVariant?: "default" | "outline";
};

export function ClientIoSendControls({
  io,
  campaignId,
  sendRecipientsJson,
  recipientCount,
  hasDocument,
  compact = false,
  buttonVariant = "default",
}: ClientIoSendControlsProps) {
  const [sendState, sendAction, sending] = useActionState(sendClientIoAction, INITIAL_STATE);

  useEffect(() => {
    if (!sendState.message) return;
    if (sendState.ok) toast.success(sendState.message);
    else toast.error(sendState.message);
  }, [sendState]);

  const sendLabel =
    io.status === "sent" ||
    io.status === "under_client_review" ||
    io.status === "approved"
      ? "Resend Client IO"
      : "Send Client IO";

  if (io.status === "approved") {
    return null;
  }

  const disabled = sending || recipientCount === 0 || !hasDocument;

  return (
    <form action={sendAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={io.id} />
      <input type="hidden" name="campaign_header_id" value={campaignId} />
      <input type="hidden" name="send_recipients" value={sendRecipientsJson} />
      <Button
        type="submit"
        size="sm"
        variant={buttonVariant}
        disabled={disabled}
        className={cn(
          compact && buttonVariant === "default"
            ? cn(OPERATIONAL_CHROME_LABEL, "h-7 px-3 font-semibold text-white shadow-sm hover:opacity-90")
            : compact
              ? cn(OPERATIONAL_CHROME_LABEL, "h-7 px-2")
              : undefined
        )}
      >
        {sending ? "Sending…" : sendLabel}
      </Button>
      {!hasDocument ? (
        <span className="text-[11px] text-muted-foreground">Generate document first</span>
      ) : recipientCount === 0 ? (
        <span className="text-[11px] text-muted-foreground">Add recipients above</span>
      ) : null}
    </form>
  );
}
