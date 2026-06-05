"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { sendClientIoAction } from "@/features/io/actions";
import {
  OPERATIONAL_CHROME_BADGE,
  OPERATIONAL_CHROME_LABEL,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import type { ClientIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

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
      <div
        className={cn(
          OPERATIONAL_CHROME_LABEL,
          "inline-flex items-center gap-2 rounded-md border border-border px-2 py-1"
        )}
      >
        <span>Client IO</span>
        <IoStatusBadge status={io.status} className={OPERATIONAL_CHROME_BADGE} />
      </div>

      {sent ? (
        <Button
          size="sm"
          variant="outline"
          className={cn(OPERATIONAL_CHROME_LABEL, "h-7 px-2")}
          asChild
        >
          <a href={viewHref}>View Client IO</a>
        </Button>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="id" value={io.id} />
          <input type="hidden" name="campaign_header_id" value={campaignId} />
          <Button
            size="sm"
            type="submit"
            disabled={pending}
            className="h-7 px-3 font-semibold text-white shadow-sm hover:opacity-90"
          >
            Send Client IO
          </Button>
        </form>
      )}

      {sent && io.status !== "approved" ? (
        <form action={formAction}>
          <input type="hidden" name="id" value={io.id} />
          <input type="hidden" name="campaign_header_id" value={campaignId} />
          <Button
            size="sm"
            variant="outline"
            type="submit"
            disabled={pending}
            className={cn(OPERATIONAL_CHROME_LABEL, "h-7 px-2")}
          >
            Resend
          </Button>
        </form>
      ) : null}
    </div>
  );
}

