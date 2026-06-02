"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { sendClientIoAction } from "@/features/io/actions";
import type { ClientIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  io: ClientIoRow;
  campaignId: string;
  viewHref: string;
};

export function ClientIoHeaderControls({ io, campaignId, viewHref }: Props) {
  const [state, formAction, pending] = useActionState(sendClientIoAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const sent = io.status === "sent" || io.status === "approved";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-3xl border border-border px-3 py-1.5 text-sm">
        <span className="text-muted-foreground">Client IO</span>
        <IoStatusBadge status={io.status} />
      </div>

      {sent ? (
        <Button size="sm" variant="outline" asChild>
          <a href={viewHref}>View Client IO</a>
        </Button>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="id" value={io.id} />
          <input type="hidden" name="campaign_header_id" value={campaignId} />
          <Button size="sm" type="submit" disabled={pending}>
            Send Client IO
          </Button>
        </form>
      )}

      {sent && io.status !== "approved" ? (
        <form action={formAction}>
          <input type="hidden" name="id" value={io.id} />
          <input type="hidden" name="campaign_header_id" value={campaignId} />
          <Button size="sm" variant="outline" type="submit" disabled={pending}>
            Resend
          </Button>
        </form>
      ) : null}
    </div>
  );
}

