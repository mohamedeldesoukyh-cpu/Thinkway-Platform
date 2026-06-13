"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ClientIoEmailPreview } from "@/lib/email/client-io-email";

type RecipientLine = {
  name?: string;
  email: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ClientIoEmailPreview;
  recipients?: RecipientLine[];
  title?: string;
};

export function ClientIoEmailViewDialog({
  open,
  onOpenChange,
  preview,
  recipients = [],
  title = "Client IO email",
}: Props) {
  const toLabel =
    recipients.length > 0
      ? recipients.map((r) => (r.name?.trim() ? `${r.name} <${r.email}>` : r.email)).join(", ")
      : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Automatic outbound message from Thinkway.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b border-border/60 bg-muted/15 px-6 py-4 text-sm">
          <div className="grid gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              From
            </span>
            <span className="text-foreground">
              {preview.fromName} &lt;{preview.fromEmail}&gt;
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              To
            </span>
            <span className="text-foreground">{toLabel}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Subject
            </span>
            <span className="font-medium text-foreground">{preview.subject}</span>
          </div>
          {preview.hasPdfAttachment ? (
            <p className="text-xs text-muted-foreground">Attachment: Client-IO.pdf</p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div
            className="rounded-md border border-border/60 bg-white p-4 text-sm text-foreground dark:bg-background"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
