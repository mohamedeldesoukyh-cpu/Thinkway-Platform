"use client";

import { useActionState, useEffect, useState } from "react";
import { BriefcaseIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateVendorCommercialCrmAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormSection,
  VendorProfileTabShell,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_TEXTAREA_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorCommercialTab({
  workspace,
  onCancel,
}: {
  workspace: VendorWorkspace;
  onCancel?: () => void;
}) {
  const profile = workspace.crm_profile;
  const rateCard = (workspace.rate_card ?? {}) as Record<string, unknown>;
  const [preferredCurrency, setPreferredCurrency] = useState(
    profile?.preferred_currency ?? String(rateCard.currency ?? "")
  );
  const [negotiationNotes, setNegotiationNotes] = useState(
    profile?.negotiation_notes ?? ""
  );
  const [baseRate, setBaseRate] = useState(
    rateCard.base_rate != null ? String(rateCard.base_rate) : ""
  );
  const [commercialNotes, setCommercialNotes] = useState(
    typeof rateCard.commercial_notes === "string" ? rateCard.commercial_notes : ""
  );

  const [state, formAction, isPending] = useActionState(
    updateVendorCommercialCrmAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <VendorProfileTabShell
      title="Commercial"
      description="Rates, preferred currency, negotiation notes — stored on the CRM profile and rate card."
      onCancel={onCancel}
    >
      <form id="vendor-commercial-form" action={formAction} className="space-y-4">
        <input type="hidden" name="influencer_id" value={workspace.id} />
        <VendorFormSection
          icon={BriefcaseIcon}
          title="Rates & preferences"
          description="Commercial terms used across quotations, campaigns, and payouts."
        >
          <VendorFormGrid>
            <VendorFormField label="Base rate">
              <Input
                name="base_rate"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.base_rate} />
            </VendorFormField>
            <VendorFormField label="Preferred currency">
              <Input
                name="preferred_currency"
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="EGP"
                className={VENDOR_FORM_INPUT_CLASS}
                disabled={isPending}
              />
            </VendorFormField>
          </VendorFormGrid>
          <div className="mt-3 space-y-3">
            <VendorFormField label="Negotiation notes">
              <Textarea
                name="negotiation_notes"
                value={negotiationNotes}
                onChange={(e) => setNegotiationNotes(e.target.value)}
                className={VENDOR_FORM_TEXTAREA_CLASS}
                rows={4}
                disabled={isPending}
              />
            </VendorFormField>
            <VendorFormField label="Commercial notes">
              <Textarea
                name="commercial_notes"
                value={commercialNotes}
                onChange={(e) => setCommercialNotes(e.target.value)}
                className={VENDOR_FORM_TEXTAREA_CLASS}
                rows={3}
                disabled={isPending}
              />
            </VendorFormField>
          </div>
        </VendorFormSection>
      </form>
    </VendorProfileTabShell>
  );
}
