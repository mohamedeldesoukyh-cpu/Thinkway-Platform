"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { DocumentUploadForm } from "@/components/forms/document-upload-form";
import { FieldError } from "@/components/forms/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import {
  getInfluencerDocumentDownloadUrlAction,
  updateVendorBankDetailsAction,
  uploadInfluencerDocumentAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { PAYMENT_TERMS_OPTIONS } from "@/features/vendors/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import {
  parseVendorPaymentDetails,
} from "@/features/vendors/utils";
import {
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  VENDOR_PAYMENT_METHOD_OPTIONS,
} from "@/lib/master-data/constants";
import { cn } from "@/lib/utils";

const INITIAL_STATE: FormActionState = { ok: false };

const BANK_LETTER_OPTIONS = INFLUENCER_DOCUMENT_TYPE_OPTIONS.filter(
  (option) => option.value === "bank_letter"
);

type VendorBankDetailsSectionProps = {
  workspace: VendorWorkspace;
};

export function VendorBankDetailsSection({ workspace }: VendorBankDetailsSectionProps) {
  const paymentDetails = useMemo(
    () => parseVendorPaymentDetails(workspace.payment_details),
    [workspace.payment_details]
  );
  const [paymentTerms, setPaymentTerms] = useState<string>(
    workspace.payment_terms ?? "net_30"
  );
  const [paymentMethod, setPaymentMethod] = useState(paymentDetails.payment_method);

  const [state, formAction, isPending] = useActionState(
    updateVendorBankDetailsAction,
    INITIAL_STATE
  );

  const bankLetters = useMemo(
    () =>
      workspace.documents.filter((document) => document.document_type === "bank_letter"),
    [workspace.documents]
  );
  const latestBankLetter = bankLetters[0] ?? null;

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <div className="space-y-4 px-4 md:px-5">
      <OperationalFormSection
        title="Bank details"
        description="Used on Vendor IO payment terms and treasury disbursement. Fields flow into generated IO documents automatically."
        footer={
          <Button type="submit" form="vendor-bank-details-form" disabled={isPending}>
            {isPending ? "Saving…" : "Save bank details"}
          </Button>
        }
      >
        <form id="vendor-bank-details-form" action={formAction} className="grid gap-4">
          <input type="hidden" name="influencer_id" value={workspace.id} />
          <input type="hidden" name="payment_terms" value={paymentTerms} />
          <input type="hidden" name="payment_method" value={paymentMethod} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label>Payment terms</Label>
              <Select
                value={paymentTerms}
                onValueChange={setPaymentTerms}
                disabled={isPending}
              >
                <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue placeholder="Select terms" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                disabled={isPending}
              >
                <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="beneficiary_name">Beneficiary name</Label>
              <Input
                id="beneficiary_name"
                name="beneficiary_name"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={
                  paymentDetails.beneficiary_name ||
                  workspace.legal_name ||
                  workspace.display_name
                }
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.beneficiary_name} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bank_name">Bank name</Label>
              <Input
                id="bank_name"
                name="bank_name"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.bank_name}
                placeholder="e.g. Arab African International Bank"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.bank_name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank_branch">Branch</Label>
              <Input
                id="bank_branch"
                name="bank_branch"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.bank_branch}
                placeholder="e.g. Park Street Branch"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="account_number">Account number</Label>
              <Input
                id="account_number"
                name="account_number"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.account_number}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.account_number} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="swift">SWIFT / BIC</Label>
              <Input
                id="swift"
                name="swift"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.swift}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                name="iban"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.iban}
                placeholder="EG00…"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.iban} />
            </div>
          </div>
        </form>
      </OperationalFormSection>

      <OperationalFormSection
        title="Bank letter"
        description="Upload the vendor's official bank confirmation letter for treasury verification."
      >
        {latestBankLetter ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{latestBankLetter.file_name}</p>
              <p className="text-xs text-muted-foreground">
                Uploaded {format(new Date(latestBankLetter.created_at), "MMM d, yyyy")}
              </p>
            </div>
            <BankLetterDownloadButton
              documentId={latestBankLetter.id}
              influencerId={workspace.id}
            />
          </div>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">
            No bank letter on file yet.
          </p>
        )}

        <DocumentUploadForm
          entityId={workspace.id}
          documentTypeOptions={BANK_LETTER_OPTIONS}
          defaultDocumentType="bank_letter"
          action={uploadBankLetterWrapper}
        />
      </OperationalFormSection>
    </div>
  );
}

async function uploadBankLetterWrapper(
  prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const mapped = new FormData();
  mapped.set("influencer_id", String(formData.get("entity_id") ?? ""));
  mapped.set("document_type", "bank_letter");
  mapped.set("expires_at", String(formData.get("expires_at") ?? ""));
  const file = formData.get("file");
  if (file) {
    mapped.set("file", file);
  }
  return uploadInfluencerDocumentAction(prev, mapped);
}

function BankLetterDownloadButton({
  documentId,
  influencerId,
}: {
  documentId: string;
  influencerId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await getInfluencerDocumentDownloadUrlAction(
            documentId,
            influencerId
          );
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (result.url) {
            window.open(result.url, "_blank", "noopener,noreferrer");
          }
        });
      }}
    >
      Download
    </Button>
  );
}
