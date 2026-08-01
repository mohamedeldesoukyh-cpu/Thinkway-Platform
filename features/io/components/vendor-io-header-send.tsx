"use client";

import { SendIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendVendorIoAction } from "@/features/io/actions";
import type { VendorIoRow } from "@/features/io/types";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { OPERATIONAL_CHROME_LABEL } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

type Props = {
  selectedRows: VendorIoRow[];
  onClearSelection: () => void;
};

export function VendorIoHeaderSend({ selectedRows, onClearSelection }: Props) {
  const [pending, startTransition] = useTransition();
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const selectedCount = selectedRows.length;

  function sendSelected() {
    if (selectedCount === 0) return;

    startTransition(async () => {
      let sent = 0;
      let failed = 0;
      let lastError: string | undefined;

      for (const row of selectedRows) {
        const formData = new FormData();
        formData.set("id", row.id);
        formData.set("campaign_header_id", row.campaign_header_id);

        const result = await sendVendorIoAction({ ok: false }, formData);
        if (result.ok) sent += 1;
        else {
          failed += 1;
          lastError = result.message;
        }
      }

      if (sent > 0) {
        toast.success(
          `Sent ${sent} vendor IO${sent === 1 ? "" : "s"}.` +
            (failed > 0 ? ` ${failed} failed.` : "")
        );
        onClearSelection();
        refreshAfterOperationalMutation();
      } else {
        toast.error(lastError ?? "No vendor IOs were sent.");
      }
    });
  }

  if (selectedCount === 0) {
    return (
      <span className="hidden text-[11px] text-muted-foreground lg:inline">
        Select rows to send, or use Send in Actions
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={sendSelected}
      className={cn(
        OPERATIONAL_CHROME_LABEL,
        "h-7 gap-1.5 bg-[#1D9E75] px-3 font-semibold text-white shadow-sm hover:bg-[#188a67]"
      )}
    >
      <SendIcon className="size-3.5" />
      {pending
        ? "Sending…"
        : `Send selected (${selectedCount})`}
    </Button>
  );
}
