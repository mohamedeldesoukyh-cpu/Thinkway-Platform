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
import type { ClientIoRow } from "@/features/io/types";
import { isClientIoRegenerateAllowed } from "@/lib/io/client-io-assignments";
import {
  seedRecipientsFromContacts,
  serializeSendRecipients,
} from "@/lib/io/client-io-send-recipients";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  io: ClientIoRow;
  campaignId: string;
  /** Legal-entity contacts used to seed recipients when IO send list is empty. */
  contactRecipients?: Array<{ label: string; email: string }>;
};

export function ClientIoHeaderControls({
  io,
  campaignId,
  contactRecipients = [],
}: Props) {
  const [generateState, generateAction, generating] = useActionState(
    generateClientIoDocumentAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!generateState.message) return;
    if (generateState.ok) toast.success(generateState.message);
    else toast.error(generateState.message);
  }, [generateState]);

  const hasDocument = Boolean(
    io.document_generated_at || io.generated_html_url || io.generated_pdf_url
  );
  const canRegenerate = isClientIoRegenerateAllowed(io.status);
  const effectiveRecipients = seedRecipientsFromContacts(
    io.send_recipients ?? [],
    contactRecipients
  );
  const sendRecipientsJson = serializeSendRecipients(effectiveRecipients);
  const recipientCount = effectiveRecipients.filter((r) => r.email.trim()).length;
  const recipientsNeedSave =
    recipientCount > 0 && (io.send_recipients ?? []).filter((r) => r.email.trim()).length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          OPERATIONAL_CHROME_LABEL,
          "thinkway-campaign-btn inline-flex h-[38px] items-center gap-2 px-[15px] text-[13px]"
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
          disabled={generating || !canRegenerate}
          title={
            !canRegenerate
              ? "Regenerate is locked after send. Use an amendment."
              : undefined
          }
          className={cn(OPERATIONAL_CHROME_LABEL, "thinkway-campaign-btn h-[38px] px-[15px] text-[13px]")}
        >
          {generating
            ? "Generating…"
            : hasDocument
              ? "Regenerate document"
              : "Generate document"}
        </Button>
      </form>

      {hasDocument ? <ClientIoViewMenu clientIoId={io.id} size="sm" /> : null}

      <ClientIoSendControls
        io={io}
        campaignId={campaignId}
        sendRecipientsJson={sendRecipientsJson}
        recipientCount={recipientCount}
        hasDocument={hasDocument}
        compact
        recipientsNeedSave={recipientsNeedSave}
      />
    </div>
  );
}
