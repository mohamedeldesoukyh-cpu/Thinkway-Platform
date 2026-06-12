"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ClientIoRecipientSelect } from "@/features/io/components/client-io-recipient-select";
import { sendClientIoAction } from "@/features/io/actions";
import {
  OPERATIONAL_CHROME_LABEL,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type ClientIoSendControlsProps = {
  io: ClientIoRow;
  campaignId: string;
  recipients: ClientIoSendRecipient[];
  compact?: boolean;
  buttonVariant?: "default" | "outline";
};

export function ClientIoSendControls({
  io,
  campaignId,
  recipients,
  compact = false,
  buttonVariant = "default",
}: ClientIoSendControlsProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendState, sendAction, sending] = useActionState(sendClientIoAction, INITIAL_STATE);

  useEffect(() => {
    if (recipientEmail) return;
    const primary = recipients.find((recipient) => recipient.email)?.email ?? "";
    if (primary) setRecipientEmail(primary);
  }, [recipients, recipientEmail]);

  useEffect(() => {
    if (!sendState.message) return;
    if (sendState.ok) toast.success(sendState.message);
    else toast.error(sendState.message);
  }, [sendState]);

  const sendLabel =
    io.status === "sent" || io.status === "approved" ? "Resend Client IO" : "Send Client IO";

  if (io.status === "approved") {
    return null;
  }

  return (
    <form action={sendAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={io.id} />
      <input type="hidden" name="campaign_header_id" value={campaignId} />
      <input type="hidden" name="recipient_email" value={recipientEmail} />
      <ClientIoRecipientSelect
        recipients={recipients}
        value={recipientEmail}
        onValueChange={setRecipientEmail}
        disabled={sending || recipients.length === 0}
        compact={compact}
      />
      <Button
        type="submit"
        size="sm"
        variant={buttonVariant}
        disabled={sending || recipients.length === 0 || !recipientEmail}
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
    </form>
  );
}
