"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { EyeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DetailFormSection } from "@/features/campaigns/components/operational-detail-panel";
import { ClientIoEmailViewDialog } from "@/features/io/components/client-io-email-view-dialog";
import type { ClientIoSendHistoryEntry } from "@/features/io/types";
import type { ClientIoEmailPreview } from "@/lib/email/client-io-email";
import { getEmailFromAddress } from "@/lib/email/provider";
import { cn } from "@/lib/utils";

type Props = {
  history: ClientIoSendHistoryEntry[];
};

function statusClass(status: string | null): string {
  switch (status) {
    case "sent":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "bg-destructive/10 text-destructive";
    case "queued":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function historyEntryToPreview(entry: ClientIoSendHistoryEntry): ClientIoEmailPreview | null {
  if (!entry.email_html && !entry.email_text) return null;

  return {
    subject: entry.subject ?? "Client Insertion Order",
    fromEmail: entry.sender_email ?? getEmailFromAddress(),
    fromName: entry.sent_by_display_name ?? entry.sent_by_name ?? "Thinkway",
    html:
      entry.email_html ??
      `<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap;">${entry.email_text ?? ""}</pre>`,
    plainText: entry.email_text ?? "",
    hasPdfAttachment: false,
  };
}

export function ClientIoSendHistory({ history }: Props) {
  const [viewEntry, setViewEntry] = useState<ClientIoSendHistoryEntry | null>(null);

  const viewPreview = useMemo(
    () => (viewEntry ? historyEntryToPreview(viewEntry) : null),
    [viewEntry]
  );

  return (
    <>
      <DetailFormSection label="Send history" className="py-3.5">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Client IO emails sent yet for this campaign.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Sent at</th>
                  <th className="px-3 py-2 font-medium">Recipient</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">By</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const canView = Boolean(entry.email_html || entry.email_text);
                  return (
                    <tr key={entry.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {entry.sent_at
                          ? format(new Date(entry.sent_at), "MMM d, yyyy HH:mm")
                          : format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">
                          {entry.recipient_name?.trim() || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.recipient_email ?? "—"}
                        </div>
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2.5 text-muted-foreground">
                        {entry.subject ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {entry.sender_email ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {entry.sent_by_name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                            statusClass(entry.delivery_status)
                          )}
                        >
                          {entry.delivery_status ?? "unknown"}
                        </span>
                        {entry.delivery_error ? (
                          <div className="mt-1 text-xs text-destructive">{entry.delivery_error}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        {canView ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setViewEntry(entry)}
                          >
                            <EyeIcon className="mr-1 size-3.5" />
                            View email
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DetailFormSection>

      {viewPreview && viewEntry ? (
        <ClientIoEmailViewDialog
          open={Boolean(viewEntry)}
          onOpenChange={(open) => {
            if (!open) setViewEntry(null);
          }}
          preview={viewPreview}
          recipients={
            viewEntry.recipient_email
              ? [
                  {
                    name: viewEntry.recipient_name ?? undefined,
                    email: viewEntry.recipient_email,
                  },
                ]
              : []
          }
          title="Sent email"
        />
      ) : null}
    </>
  );
}
