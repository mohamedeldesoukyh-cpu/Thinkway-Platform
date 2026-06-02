"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateClientIoAction, sendClientIoAction } from "@/features/io/actions";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import type { ClientIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  row: ClientIoRow;
};

export function ClientIoForm({ row }: Props) {
  const [termsText, setTermsText] = useState(row.terms_text ?? "");
  const [termsHtml, setTermsHtml] = useState(row.terms_html ?? "");
  const [billingTerms, setBillingTerms] = useState(row.billing_terms ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState(row.attachment_url ?? "");

  const [saveState, saveAction, saving] = useActionState(updateClientIoAction, INITIAL_STATE);
  const [sendState, sendAction, sending] = useActionState(sendClientIoAction, INITIAL_STATE);

  useEffect(() => {
    if (!saveState.message) return;
    if (saveState.ok) toast.success(saveState.message);
    else toast.error(saveState.message);
  }, [saveState]);

  useEffect(() => {
    if (!sendState.message) return;
    if (sendState.ok) toast.success(sendState.message);
    else toast.error(sendState.message);
  }, [sendState]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Client IO · {row.campaign_name}</span>
          <IoStatusBadge status={row.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={saveAction} className="grid gap-4">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
          <input type="hidden" name="status" value={row.status} />

          <div className="grid gap-2">
            <Label htmlFor="terms_text">Terms (plain text)</Label>
            <Textarea
              id="terms_text"
              name="terms_text"
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              rows={8}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="terms_html">Terms (optional HTML)</Label>
            <Textarea
              id="terms_html"
              name="terms_html"
              value={termsHtml}
              onChange={(e) => setTermsHtml(e.target.value)}
              rows={6}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="billing_terms">Billing terms</Label>
            <Input
              id="billing_terms"
              name="billing_terms"
              value={billingTerms}
              onChange={(e) => setBillingTerms(e.target.value)}
              placeholder="Net 30, invoicing notes..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="attachment_url">Attachment URL (PO/SOW/PDF)</Label>
            <Input
              id="attachment_url"
              name="attachment_url"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" variant="outline" disabled={saving}>
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          </div>
        </form>

        <form action={sendAction} className="flex justify-end">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
          <Button type="submit" disabled={sending}>
            {row.status === "sent" ? "Resend Client IO" : "Send Client IO"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

