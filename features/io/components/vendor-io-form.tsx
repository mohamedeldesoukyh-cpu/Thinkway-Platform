"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailEditBlock,
  DetailFormSection,
  DetailPill,
  DetailSheetFooter,
} from "@/features/campaigns/components/operational-detail-panel";
import { updateVendorIoAction } from "@/features/io/actions";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { VendorIoDocumentActions } from "@/features/io/components/vendor-io-document-actions";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import type { VendorIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

const DETAIL_TEXTAREA_CLASS =
  "min-h-[4.5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

type Props = {
  row: VendorIoRow;
};

export function VendorIoForm({ row }: Props) {
  const [termsText, setTermsText] = useState(row.terms_text ?? "");
  const [termsHtml, setTermsHtml] = useState(row.terms_html ?? "");
  const [usageRights, setUsageRights] = useState(row.usage_rights ?? "");
  const [exclusivity, setExclusivity] = useState(row.exclusivity ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState(row.attachment_url ?? "");

  const [saveState, saveAction, saving] = useActionState(updateVendorIoAction, INITIAL_STATE);

  useEffect(() => {
    setTermsText(row.terms_text ?? "");
    setTermsHtml(row.terms_html ?? "");
    setUsageRights(row.usage_rights ?? "");
    setExclusivity(row.exclusivity ?? "");
    setAttachmentUrl(row.attachment_url ?? "");
  }, [row]);

  useEffect(() => {
    if (!saveState.message) return;
    if (saveState.ok) toast.success(saveState.message);
    else toast.error(saveState.message);
  }, [saveState]);

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Vendor IO ·{" "}
            {row.document_number ? (
              <DocumentNumber value={row.document_number} />
            ) : (
              row.influencer_name
            )}
          </h2>
          <div className="inline-flex flex-wrap items-center gap-2">
            <span className="text-[11px] tabular-nums text-foreground/90">
              {formatOperationalAmount(row.amount)}
            </span>
            <DetailPill>{row.currency_code}</DetailPill>
            <IoStatusBadge status={row.status} />
            <VendorIoUngenerateTrigger
              row={row}
              disabled={!row.ungenerate_eligible}
              title={row.ungenerate_ineligible_reason ?? undefined}
            />
          </div>
        </div>
      }
    >
      <form id="vendor-io-save" action={saveAction} className="flex flex-col">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
        <input type="hidden" name="status" value={row.status} />

        <div className="px-6 py-4">
          <p className="mb-4 text-[11px] text-muted-foreground">
            Payout bank details are managed on the{" "}
            <Link
              href={`/vendors/${row.influencer_id}?tab=billing`}
              className="font-medium text-foreground hover:underline"
            >
              vendor Billing &amp; Payments
            </Link>{" "}
            tab and appear live on the IO document.
          </p>
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

            <div className="grid gap-5 border-b border-border/40 py-3.5 md:grid-cols-2">
              <DetailFormSection label="Usage rights">
                <Input
                  id="usage_rights"
                  name="usage_rights"
                  value={usageRights}
                  onChange={(e) => setUsageRights(e.target.value)}
                  placeholder="e.g. 6 months paid media rights"
                  className={DETAIL_FORM_INPUT_CLASS}
                />
              </DetailFormSection>
              <DetailFormSection label="Exclusivity">
                <Input
                  id="exclusivity"
                  name="exclusivity"
                  value={exclusivity}
                  onChange={(e) => setExclusivity(e.target.value)}
                  placeholder="e.g. Beauty category for 30 days"
                  className={DETAIL_FORM_INPUT_CLASS}
                />
              </DetailFormSection>
            </div>

            <DetailFormSection label="Attachment URL (PO/SOW/signed PDF)" className="py-3.5">
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

      <DetailSheetFooter>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <VendorIoDocumentActions row={row} />
          <Button
            form="vendor-io-save"
            type="submit"
            variant="outline"
            size="sm"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </DetailSheetFooter>
    </OperationalTableSection>
  );
}
