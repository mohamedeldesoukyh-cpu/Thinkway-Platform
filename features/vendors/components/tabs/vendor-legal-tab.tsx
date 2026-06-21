"use client";

import { useActionState, useEffect, useState } from "react";
import { ScaleIcon } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateVendorLegalAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
} from "@/features/vendors/constants";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormKeyboardShortcuts,
  VendorFormSection,
  VendorProfileTabShell,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import type {
  ContractStatus,
  ExclusivityType,
  VendorDetail,
} from "@/types/database";
import { cn } from "@/lib/utils";

export function VendorLegalTab({
  vendor,
  onCancel,
  shortcutsEnabled = true,
  embedded = false,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
  /** When true, render form only (parent provides shell). */
  embedded?: boolean;
}) {
  const [contractStatus, setContractStatus] = useState(
    vendor.contract_status ?? "none"
  );
  const [exclusivity, setExclusivity] = useState(vendor.exclusivity ?? "none");

  const [state, formAction, isPending] = useActionState(
    updateVendorLegalAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const form = (
    <form id="vendor-legal-form" action={formAction} className="grid gap-[18px]">
      <input type="hidden" name="influencer_id" value={vendor.id} />
      <input type="hidden" name="contract_status" value={contractStatus} />
      <input type="hidden" name="exclusivity" value={exclusivity} />

      <VendorFormSection
        icon={ScaleIcon}
        title="Legal & contract"
        description="Contract status, expiry, and exclusivity terms."
      >
        <VendorFormGrid className="lg:grid-cols-3">
          <VendorFormField label="Contract status">
            <Select
              value={contractStatus}
              onValueChange={(v) => setContractStatus(v as ContractStatus)}
              disabled={isPending}
            >
              <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </VendorFormField>
          <VendorFormField label="Contract expiry" htmlFor="contract_expiry">
            <Input
              id="contract_expiry"
              name="contract_expiry"
              type="date"
              className={VENDOR_FORM_INPUT_CLASS}
              defaultValue={vendor.contract_expiry ?? ""}
              disabled={isPending}
            />
          </VendorFormField>
          <VendorFormField label="Exclusivity">
            <Select
              value={exclusivity}
              onValueChange={(v) => setExclusivity(v as ExclusivityType)}
              disabled={isPending}
            >
              <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXCLUSIVITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </VendorFormField>
        </VendorFormGrid>
      </VendorFormSection>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <>
      <VendorFormKeyboardShortcuts
        formId="vendor-legal-form"
        enabled={shortcutsEnabled}
        disabled={isPending}
      />
      <VendorProfileTabShell
        title="Legal & contract"
        description="Contract status, expiry, and exclusivity for this creator."
        onCancel={onCancel}
        saveFormId="vendor-legal-form"
        saveLabel="Save legal"
        saveDisabled={isPending}
        isSaving={isPending}
      >
        {form}
      </VendorProfileTabShell>
    </>
  );
}
