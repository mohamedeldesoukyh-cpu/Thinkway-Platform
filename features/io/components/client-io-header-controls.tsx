"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
  readClientIoLiveRecipients,
  subscribeClientIoLiveRecipients,
} from "@/lib/io/client-io-live-recipients";
import {
  parseSendRecipientsJson,
  seedRecipientsFromContacts,
  serializeSendRecipients,
  type ClientIoRecipientEntry,
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
  const [liveRecipients, setLiveRecipients] = useState<ClientIoRecipientEntry[] | null>(
    null
  );

  useEffect(() => {
    if (!generateState.message) return;
    if (generateState.ok) toast.success(generateState.message);
    else toast.error(generateState.message);
  }, [generateState]);

  useEffect(() => {
    setLiveRecipients(readClientIoLiveRecipients(io.id));
    return subscribeClientIoLiveRecipients(io.id, setLiveRecipients);
  }, [io.id]);

  const seededRecipients = useMemo(
    () =>
      seedRecipientsFromContacts(
        parseSendRecipientsJson(io.send_recipients),
        contactRecipients
      ),
    [io.send_recipients, contactRecipients]
  );

  const effectiveRecipients = useMemo(() => {
    const live = liveRecipients ? parseSendRecipientsJson(liveRecipients) : [];
    if (live.length > 0) return live;
    return seededRecipients;
  }, [liveRecipients, seededRecipients]);

  const sendRecipientsJson = serializeSendRecipients(effectiveRecipients);
  const recipientCount = effectiveRecipients.filter((r) => r.email.trim()).length;
  const recipientsNeedSave =
    recipientCount > 0 && parseSendRecipientsJson(io.send_recipients).length === 0;

  const hasDocument = Boolean(
    io.document_generated_at || io.generated_html_url || io.generated_pdf_url
  );
  const canRegenerate = isClientIoRegenerateAllowed(io.status);

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
          {generating ? "Generating…" : hasDocument ? "Regenerate" : "Generate"}
        </Button>
      </form>

      {hasDocument ? (
        <ClientIoViewMenu
          clientIoId={io.id}
          size="sm"
          variant="outline"
          label="View"
          showChevron={false}
          buttonClassName="tw-b sm thinkway-campaign-btn"
        />
      ) : null}

      <ClientIoSendControls
        io={io}
        campaignId={campaignId}
        sendRecipientsJson={sendRecipientsJson}
        recipientCount={recipientCount}
        hasDocument={hasDocument}
        compact
        buttonVariant="outline"
        recipientsNeedSave={recipientsNeedSave}
      />
    </div>
  );
}
