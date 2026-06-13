"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { regenerateVendorIoDocumentAction } from "@/features/io/regenerate-vendor-io-document-action";
import { VendorIoSendButton } from "@/features/io/components/vendor-io-send-button";
import type { VendorIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

type VendorIoDocumentActionsProps = {
  row: VendorIoRow;
  showSend?: boolean;
  showRegenerate?: boolean;
};

export function VendorIoDocumentActions({
  row,
  showSend = true,
  showRegenerate = true,
}: VendorIoDocumentActionsProps) {
  const [regenState, regenAction, regenerating] = useActionState(
    regenerateVendorIoDocumentAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!regenState.message) return;
    if (regenState.ok) toast.success(regenState.message);
    else toast.error(regenState.message);
  }, [regenState]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href={`/ios/vendor/${row.id}/preview`} target="_blank" rel="noopener noreferrer">
          View IO
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a
          href={`/api/vendor-ios/${row.id}/document?format=html`}
          target="_blank"
          rel="noopener noreferrer"
        >
          HTML
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a
          href={`/api/vendor-ios/${row.id}/document?format=pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          PDF
        </a>
      </Button>
      {showRegenerate ? (
        <form action={regenAction}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
          <Button size="sm" variant="outline" type="submit" disabled={regenerating}>
            {regenerating ? "Refreshing…" : "Refresh document"}
          </Button>
        </form>
      ) : null}
      {showSend ? <VendorIoSendButton row={row} /> : null}
    </div>
  );
}
