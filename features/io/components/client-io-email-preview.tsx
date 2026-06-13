"use client";

import { useMemo, useState } from "react";
import { EyeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DetailFormSection } from "@/features/campaigns/components/operational-detail-panel";
import { ClientIoEmailViewDialog } from "@/features/io/components/client-io-email-view-dialog";
import type { ClientIoRow } from "@/features/io/types";
import {
  buildClientIoEmailPreview,
  type ClientIoEmailPreview as EmailPreview,
} from "@/lib/email/client-io-email";
import type { ClientIoRecipientEntry } from "@/lib/io/client-io-send-recipients";

type Props = {
  io: ClientIoRow;
  senderName: string | null;
  recipients: ClientIoRecipientEntry[];
  hasDocument: boolean;
};

function formatRecipients(recipients: ClientIoRecipientEntry[]): string {
  const valid = recipients.filter((r) => r.email.trim());
  if (valid.length === 0) return "—";
  return valid
    .map((r) => (r.name.trim() ? `${r.name.trim()} <${r.email.trim()}>` : r.email.trim()))
    .join(", ");
}

export function ClientIoEmailPreviewSection({ io, senderName, recipients, hasDocument }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const preview = useMemo<EmailPreview>(
    () =>
      buildClientIoEmailPreview({
        io,
        senderName,
        isDraftPreview: true,
      }),
    [io, senderName]
  );

  const validRecipients = recipients.filter((r) => r.email.trim());

  return (
    <>
      <DetailFormSection label="Email preview" className="py-3.5">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          This is the automatic message sent from{" "}
          <strong className="font-medium text-foreground">{preview.fromEmail}</strong> when you click{" "}
          <strong className="font-medium text-foreground">Send Client IO</strong>. The subject and
          body below are generated for you — recipients do not need to draft anything.
        </p>

        <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                From
              </div>
              <div className="mt-0.5 text-foreground">
                {preview.fromName} &lt;{preview.fromEmail}&gt;
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                To
              </div>
              <div className="mt-0.5 text-foreground">{formatRecipients(recipients)}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Subject
            </div>
            <div className="mt-0.5 font-medium text-foreground">{preview.subject}</div>
          </div>

          <div className="rounded-md border border-border/50 bg-background/80 p-3 text-sm leading-relaxed text-muted-foreground">
            <p className="whitespace-pre-wrap text-foreground">{preview.plainText}</p>
          </div>

          {preview.hasPdfAttachment ? (
            <p className="text-xs text-muted-foreground">Includes PDF attachment: Client-IO.pdf</p>
          ) : hasDocument ? null : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Generate the document before sending so the PDF can be attached.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setDialogOpen(true)}
          >
            <EyeIcon className="mr-1.5 size-3.5" />
            View full email
          </Button>
        </div>
      </DetailFormSection>

      <ClientIoEmailViewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preview={preview}
        recipients={validRecipients}
        title="Email preview"
      />
    </>
  );
}
