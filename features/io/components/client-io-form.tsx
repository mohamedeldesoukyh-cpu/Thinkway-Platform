"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailEditBlock,
  DetailFormSection,
  DetailSheetFooter,
} from "@/features/campaigns/components/operational-detail-panel";
import { updateClientIoAction, sendClientIoAction } from "@/features/io/actions";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import type { ClientIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

const DETAIL_TEXTAREA_CLASS =
  "min-h-[4.5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

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
    setTermsText(row.terms_text ?? "");
    setTermsHtml(row.terms_html ?? "");
    setBillingTerms(row.billing_terms ?? "");
    setAttachmentUrl(row.attachment_url ?? "");
  }, [row]);

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
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Client IO · {row.campaign_name}
          </h2>
          <IoStatusBadge status={row.status} />
        </div>
      }
    >
      <form id="client-io-save" action={saveAction} className="flex flex-col">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
        <input type="hidden" name="status" value={row.status} />

        <div className="px-6 py-4">
          <div className="space-y-1">
            <DetailEditBlock label="Terms (plain text)">
              <Textarea
                id="terms_text"
                name="terms_text"
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                rows={8}
                className={DETAIL_TEXTAREA_CLASS}
              />
            </DetailEditBlock>

            <DetailEditBlock label="Terms (optional HTML)">
              <Textarea
                id="terms_html"
                name="terms_html"
                value={termsHtml}
                onChange={(e) => setTermsHtml(e.target.value)}
                rows={6}
                className={DETAIL_TEXTAREA_CLASS}
              />
            </DetailEditBlock>

            <DetailFormSection label="Billing terms" className="py-3.5">
              <Input
                id="billing_terms"
                name="billing_terms"
                value={billingTerms}
                onChange={(e) => setBillingTerms(e.target.value)}
                placeholder="Net 30, invoicing notes..."
                className={DETAIL_FORM_INPUT_CLASS}
              />
            </DetailFormSection>

            <DetailFormSection label="Attachment URL (PO/SOW/PDF)" className="py-3.5">
              <Input
                id="attachment_url"
                name="attachment_url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className={DETAIL_FORM_INPUT_CLASS}
              />
            </DetailFormSection>
          </div>
        </div>
      </form>

      <form id="client-io-send" action={sendAction} className="hidden">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
      </form>

      <DetailSheetFooter>
        <Button
          form="client-io-save"
          type="submit"
          variant="outline"
          size="sm"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button form="client-io-send" type="submit" size="sm" disabled={sending}>
          {sending
            ? "Sending…"
            : row.status === "sent"
              ? "Resend client IO"
              : "Send client IO"}
        </Button>
      </DetailSheetFooter>
    </OperationalTableSection>
  );
}
