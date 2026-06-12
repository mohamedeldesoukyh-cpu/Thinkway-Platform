"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { ClientIoViewMenu } from "@/features/io/components/client-io-view-menu";
import { ClientIoSendControls } from "@/features/io/components/client-io-send-controls";
import { generateClientIoDocumentAction } from "@/features/io/generate-client-io-document-action";
import {
  OPERATIONAL_CHROME_BADGE,
  OPERATIONAL_CHROME_LABEL,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  io: ClientIoRow;
  campaignId: string;
  recipients: ClientIoSendRecipient[];
};

export function ClientIoHeaderControls({ io, campaignId, recipients }: Props) {
  const [generateState, generateAction, generating] = useActionState(
    generateClientIoDocumentAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!generateState.message) return;
    if (generateState.ok) toast.success(generateState.message);
    else toast.error(generateState.message);
  }, [generateState]);

  const hasDocument = Boolean(io.document_generated_at || io.generated_html_url || io.terms_html);

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

      <form action={generateAction}>
        <input type="hidden" name="id" value={io.id} />
        <input type="hidden" name="campaign_header_id" value={campaignId} />
        <Button
          size="sm"
          variant="outline"
          type="submit"
          disabled={generating}
          className={cn(OPERATIONAL_CHROME_LABEL, "h-7 px-2")}
        >
          {generating
            ? "Generating…"
            : hasDocument
              ? "Regenerate document"
              : "Generate document"}
        </Button>
      </form>

      {hasDocument ? (
        <ClientIoViewMenu
          clientIoId={io.id}
          size="sm"
          variant="outline"
        />
      ) : null}

      <ClientIoSendControls
        io={io}
        campaignId={campaignId}
        recipients={recipients}
        compact
      />
    </div>
  );
}
