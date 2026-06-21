"use client";

import { useActionState, useEffect, useState } from "react";
import { UserIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  updateVendorOverviewAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  COUNTRY_OPTIONS,
  GENDER_OPTIONS,
  NATIONALITY_OPTIONS,
  VENDOR_STATUS_OPTIONS,
} from "@/features/vendors/constants";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormKeyboardShortcuts,
  VendorFormSection,
  VendorProfileTabShell,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_SELECT_TRIGGER_CLASS,
  VENDOR_FORM_TEXTAREA_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import type { InfluencerStatus, VendorDetail } from "@/types/database";
import { cn } from "@/lib/utils";

export function VendorOverviewTab({
  vendor,
  portalAccessPanel,
  onCancel,
  shortcutsEnabled = true,
}: {
  vendor: VendorDetail;
  portalAccessPanel?: React.ReactNode;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
}) {
  const [status, setStatus] = useState(vendor.status);
  const [country, setCountry] = useState(vendor.country_code ?? "");
  const [nationality, setNationality] = useState(vendor.nationality ?? "");
  const [gender, setGender] = useState(vendor.gender ?? "");

  const [state, formAction, isPending] = useActionState(
    updateVendorOverviewAction,
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

  return (
    <>
      <VendorFormKeyboardShortcuts
        formId="vendor-overview-form"
        enabled={shortcutsEnabled}
        disabled={isPending}
      />
      <VendorProfileTabShell
        title="Creator overview"
        description="Profile details, contact information, and operational status."
        onCancel={onCancel}
        saveFormId="vendor-overview-form"
        saveLabel="Save overview"
        saveDisabled={isPending}
        isSaving={isPending}
      >
        {portalAccessPanel ? <div className="mb-[18px]">{portalAccessPanel}</div> : null}
        <form id="vendor-overview-form" action={formAction} className="grid gap-[18px]">
          <input type="hidden" name="influencer_id" value={vendor.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="country_code" value={country} />
          <input type="hidden" name="nationality" value={nationality} />
          <input type="hidden" name="gender" value={gender} />

          <VendorFormSection
            icon={UserIcon}
            title="Profile"
            description="Core creator identity and contact details."
          >
            <VendorFormGrid>
              <VendorFormField label="Creator name" htmlFor="display_name">
                <Input
                  id="display_name"
                  name="display_name"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.display_name}
                  required
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.display_name} />
              </VendorFormField>
              <VendorFormField label="Management agency" htmlFor="legal_name">
                <Input
                  id="legal_name"
                  name="legal_name"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.legal_name ?? ""}
                  disabled={isPending}
                />
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormGrid className="lg:grid-cols-3">
              <VendorFormField label="Status">
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as InfluencerStatus)}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </VendorFormField>
              <VendorFormField label="Gender">
                <Select
                  value={gender}
                  onValueChange={setGender}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </VendorFormField>
              <VendorFormField label="City" htmlFor="city">
                <Input
                  id="city"
                  name="city"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.city ?? ""}
                  disabled={isPending}
                />
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormGrid>
              <VendorFormField label="Country">
                <SearchableSelect
                  value={country}
                  onValueChange={setCountry}
                  options={COUNTRY_OPTIONS}
                  disabled={isPending}
                />
              </VendorFormField>
              <VendorFormField label="Nationality">
                <SearchableSelect
                  value={nationality}
                  onValueChange={setNationality}
                  options={NATIONALITY_OPTIONS}
                  disabled={isPending}
                />
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormGrid>
              <VendorFormField label="Email" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.email ?? ""}
                  disabled={isPending}
                />
              </VendorFormField>
              <VendorFormField label="Phone" htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.phone ?? ""}
                  disabled={isPending}
                />
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormField label="Portfolio / URL" htmlFor="influencer_url">
              <Input
                id="influencer_url"
                name="influencer_url"
                type="url"
                className={VENDOR_FORM_INPUT_CLASS}
                defaultValue={vendor.influencer_url ?? ""}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.influencer_url} />
            </VendorFormField>

            <VendorFormField label="Agency contact name" htmlFor="management_agency">
              <Input
                id="management_agency"
                name="management_agency"
                className={VENDOR_FORM_INPUT_CLASS}
                defaultValue={vendor.management_agency ?? ""}
                disabled={isPending}
              />
            </VendorFormField>

            <VendorFormGrid>
              <VendorFormField label="Categories / niche" htmlFor="categories">
                <Input
                  id="categories"
                  name="categories"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.categories?.join(", ") ?? ""}
                  placeholder="beauty, lifestyle"
                  disabled={isPending}
                />
                <p className="text-[11.5px] text-[#9099A8]">Comma-separated</p>
              </VendorFormField>
              <VendorFormField label="Languages" htmlFor="languages">
                <Input
                  id="languages"
                  name="languages"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.languages?.join(", ") ?? ""}
                  placeholder="en, ar"
                  disabled={isPending}
                />
                <p className="text-[11.5px] text-[#9099A8]">
                  Comma-separated language codes (e.g. en, ar)
                </p>
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormField label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                className={VENDOR_FORM_TEXTAREA_CLASS}
                defaultValue={vendor.notes ?? ""}
                disabled={isPending}
              />
            </VendorFormField>
          </VendorFormSection>
        </form>
      </VendorProfileTabShell>
    </>
  );
}
