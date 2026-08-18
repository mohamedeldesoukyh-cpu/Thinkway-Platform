"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { ClientReviewRecipient } from "../actions/load-client-review-recipients-action";
import { loadClientReviewRecipientsAction } from "../actions/load-client-review-recipients-action";
import { sendClientReviewEmailAction } from "../actions/send-client-review-email-action";

export function ClientReviewSendDialog({
  open,
  onOpenChange,
  quotationId,
  clientId,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  clientId: string | null;
  onSent?: () => void;
}) {
  const [recipients, setRecipients] = useState<ClientReviewRecipient[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const loading = Boolean(open && clientId && loadedKey !== clientId);

  useEffect(() => {
    if (!open || !clientId) return;
    const requested = clientId;
    let cancelled = false;
    void loadClientReviewRecipientsAction({ clientId: requested }).then((result) => {
      if (cancelled) return;
      setLoadedKey(requested);
      if (!result.ok) {
        toast.error(result.message);
        setRecipients([]);
        setSelected([]);
        return;
      }
      setRecipients(result.recipients);
      setSelected(result.recipients.map((row) => row.email));
    });
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  function toggle(email: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...new Set([...current, email])] : current.filter((item) => item !== email)
    );
  }

  async function send() {
    if (selected.length === 0) {
      toast.error("Select at least one client email.");
      return;
    }
    setSending(true);
    try {
      const result = await sendClientReviewEmailAction({
        quotationId,
        emails: selected,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onSent?.();
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send to client</DialogTitle>
          <DialogDescription>
            Choose which stored client emails should receive the Client Workspace link.
          </DialogDescription>
        </DialogHeader>
        {!clientId ? (
          <p className="text-sm text-muted-foreground">
            This quotation has no legal entity. Add a client to send the proposal by email.
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading client emails…</p>
        ) : recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No emails are stored on this legal entity. Add a billing email or contacts first.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {recipients.map((recipient) => {
              const checked = selected.includes(recipient.email);
              return (
                <li key={recipient.id} className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggle(recipient.email, value === true)}
                    aria-label={`Select ${recipient.email}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{recipient.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{recipient.email}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={sending || !clientId || selected.length === 0}
            onClick={() => void send()}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
