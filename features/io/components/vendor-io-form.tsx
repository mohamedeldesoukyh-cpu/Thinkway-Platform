"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateVendorIoAction, sendVendorIoAction } from "@/features/io/actions";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import type { VendorIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  row: VendorIoRow;
};

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function VendorIoForm({ row }: Props) {
  const [termsText, setTermsText] = useState(row.terms_text ?? "");
  const [termsHtml, setTermsHtml] = useState(row.terms_html ?? "");
  const [usageRights, setUsageRights] = useState(row.usage_rights ?? "");
  const [exclusivity, setExclusivity] = useState(row.exclusivity ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState(row.attachment_url ?? "");

  const [saveState, saveAction, saving] = useActionState(updateVendorIoAction, INITIAL_STATE);
  const [sendState, sendAction, sending] = useActionState(sendVendorIoAction, INITIAL_STATE);

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
          <span>
            Vendor IO ·{" "}
            {row.document_number ? (
              <DocumentNumber value={row.document_number} />
            ) : (
              row.influencer_name
            )}
          </span>
          <div className="inline-flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{formatMoney(row.amount, row.currency_code)}</span>
            <IoStatusBadge status={row.status} />
            <VendorIoUngenerateTrigger
              row={row}
              disabled={!row.ungenerate_eligible}
              title={row.ungenerate_ineligible_reason ?? undefined}
            />
          </div>
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

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="usage_rights">Usage rights</Label>
              <Input
                id="usage_rights"
                name="usage_rights"
                value={usageRights}
                onChange={(e) => setUsageRights(e.target.value)}
                placeholder="e.g. 6 months paid media rights"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exclusivity">Exclusivity</Label>
              <Input
                id="exclusivity"
                name="exclusivity"
                value={exclusivity}
                onChange={(e) => setExclusivity(e.target.value)}
                placeholder="e.g. Beauty category for 30 days"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="attachment_url">Attachment URL (PO/SOW/signed PDF)</Label>
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
            {row.status === "sent" ? "Resend Vendor IO" : "Send to Influencer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

