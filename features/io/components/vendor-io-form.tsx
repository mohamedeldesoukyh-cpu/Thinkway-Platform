"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Input } from "@/components/ui/input";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailFormSection,
  DetailPill,
  DetailSheetFooter,
} from "@/features/campaigns/components/operational-detail-panel";
import {
  saveVendorIoTermsAsVendorDefaultAction,
  updateVendorIoAction,
} from "@/features/io/actions";
import { ClientIoTermsEditorField } from "@/features/io/components/client-io-terms-editor";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { IoTermsSourceBadge } from "@/features/io/components/io-terms-source-badge";
import { VendorIoDocumentActions } from "@/features/io/components/vendor-io-document-actions";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import type { VendorIoRow } from "@/features/io/types";
import { VENDOR_IO_DEFAULT_TERMS } from "@/lib/io/vendor-io-default-terms";
import {
  parseTermsText,
  resolveDefaultTermsForVendor,
  resolveIoTermsSource,
  serializeTermsText,
  termsAreEqual,
  type ClientIoTerm,
} from "@/lib/io/client-io-terms";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  row: VendorIoRow;
};

export function VendorIoForm({ row }: Props) {
  const vendorDefaultTerms = useMemo(
    () => resolveDefaultTermsForVendor(row.vendor_io_terms_text),
    [row.vendor_io_terms_text]
  );

  const ioParsedTerms = useMemo(() => parseTermsText(row.terms_text), [row.terms_text]);

  const [terms, setTerms] = useState<ClientIoTerm[]>(
    () => ioParsedTerms ?? vendorDefaultTerms
  );
  const [useInheritedTerms, setUseInheritedTerms] = useState(() => !ioParsedTerms);
  const [usageRights, setUsageRights] = useState(row.usage_rights ?? "");
  const [exclusivity, setExclusivity] = useState(row.exclusivity ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState(row.attachment_url ?? "");
  const [savingAsDefault, startSaveAsDefault] = useTransition();

  const [saveState, saveAction, saving] = useActionState(updateVendorIoAction, INITIAL_STATE);

  useEffect(() => {
    const parsed = parseTermsText(row.terms_text);
    setTerms(parsed ?? vendorDefaultTerms);
    setUseInheritedTerms(!parsed);
    setUsageRights(row.usage_rights ?? "");
    setExclusivity(row.exclusivity ?? "");
    setAttachmentUrl(row.attachment_url ?? "");
  }, [row, vendorDefaultTerms]);

  useEffect(() => {
    if (!saveState.message) return;
    if (saveState.ok) toast.success(saveState.message);
    else toast.error(saveState.message);
  }, [saveState]);

  const termsSource = resolveIoTermsSource(
    parseTermsText(row.vendor_io_terms_text),
    useInheritedTerms ? null : terms
  );

  const termsTextPayload = useMemo(() => {
    if (useInheritedTerms || termsAreEqual(terms, vendorDefaultTerms)) {
      return "";
    }
    return serializeTermsText(terms);
  }, [terms, vendorDefaultTerms, useInheritedTerms]);

  function handleTermsChange(nextTerms: ClientIoTerm[]) {
    setTerms(nextTerms);
    setUseInheritedTerms(false);
  }

  function handleRestoreVendorDefault() {
    setTerms(vendorDefaultTerms);
    setUseInheritedTerms(true);
    toast.message("Terms reset to vendor default. Save draft to apply.");
  }

  function handleRestorePlatformDefault() {
    setTerms(VENDOR_IO_DEFAULT_TERMS);
    // Inherit when vendor has no defaults; otherwise persist platform copy as IO override.
    setUseInheritedTerms(!parseTermsText(row.vendor_io_terms_text));
    toast.message("Terms reset to platform default. Save draft to apply.");
  }

  function handleSaveAsVendorDefault() {
    startSaveAsDefault(async () => {
      const result = await saveVendorIoTermsAsVendorDefaultAction({
        influencerId: row.influencer_id,
        termsText: serializeTermsText(terms),
        campaignHeaderId: row.campaign_header_id,
      });
      if (result.ok) {
        toast.success(result.message);
        setUseInheritedTerms(true);
      } else {
        toast.error(result.message);
      }
    });
  }

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
            <IoTermsSourceBadge source={termsSource} />
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
        <input type="hidden" name="terms_text" value={termsTextPayload} />

        <div className="px-6 py-4">
          <p className="mb-4 text-[11px] text-muted-foreground">
            Payout bank details are managed on the{" "}
            <Link
              href={`/vendors/${row.influencer_id}?tab=billing`}
              className="font-medium text-foreground hover:underline"
            >
              vendor Billing &amp; Payments
            </Link>{" "}
            tab and appear live on the IO document. Default terms for future deals:{" "}
            <Link
              href={`/vendors/${row.influencer_id}?tab=overview`}
              className="font-medium text-foreground hover:underline"
            >
              Vendor IO Default Terms
            </Link>
            .
          </p>
          <div className="space-y-1">
            <ClientIoTermsEditorField
              label="Terms & conditions"
              terms={terms}
              onChange={handleTermsChange}
              onRecover={handleRestoreVendorDefault}
              recoverLabel="Restore Vendor Default"
              description="Structured terms injected into Section 8 of the Vendor IO template. Inherit vendor/platform defaults or customize for this deal."
              disabled={saving || savingAsDefault}
            />

            <div className="flex flex-wrap gap-2 border-b border-border/40 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || savingAsDefault}
                onClick={handleSaveAsVendorDefault}
              >
                {savingAsDefault ? "Saving…" : "Save these terms as Vendor Default"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving || savingAsDefault}
                onClick={handleRestorePlatformDefault}
              >
                Restore Platform Default
              </Button>
            </div>

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

            <DetailFormSection label="Signed document link (Drive / PDF)" className="py-3.5">
              <p className="mb-2 text-xs text-muted-foreground">
                Paste a Google Drive or https PDF link for the signed Vendor IO. No file upload —
                host the signed file externally and save the share URL here.
              </p>
              <Input
                id="attachment_url"
                name="attachment_url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
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
