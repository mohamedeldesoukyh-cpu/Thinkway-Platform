"use client";
import { VendorAgencyCard } from "../vendor-agency-card";
import { VendorLegalAttachment } from "../vendor-legal-attachment";

import { useActionState, useEffect, useState } from "react";
import { ScaleIcon, MapPinIcon, FileTextIcon } from "lucide-react";
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
  const [documentType,setDocumentType]=useState<'trade_license'|'national_id'>(vendor.metadata?.legal_document_type==='national_id'?'national_id':'trade_license');
  const value=(key:string)=>typeof vendor.metadata?.[key]==='string'?vendor.metadata[key] as string:'';
  const [numbers,setNumbers]=useState({trade_license:value('trade_license'),national_id:value('national_id_number')});
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
      <input type="hidden" name={documentType==='trade_license'?'national_id_number':'trade_license'} value={numbers[documentType==='trade_license'?'national_id':'trade_license']}/>
      <input type="hidden" name="influencer_id" value={vendor.id} />
      <input type="hidden" name="contract_status" value={contractStatus} />
      <input type="hidden" name="exclusivity" value={exclusivity} />

      {state.fieldErrors&&<div role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-700">{Object.entries(state.fieldErrors).map(([field,errors])=><p key={field}>{field.replaceAll('_',' ')}: {errors?.join(' ')}</p>)}</div>}
      <VendorFormSection icon={FileTextIcon} title="Registration & certificates" description="Legal identification and tax details used for creator registration.">
        <VendorFormGrid className="lg:grid-cols-3">
          <VendorFormField label="Legal document type" htmlFor="legal_document_type"><select id="legal_document_type" name="legal_document_type" value={documentType} onChange={e=>setDocumentType(e.target.value as 'trade_license'|'national_id')} disabled={isPending} className={VENDOR_FORM_INPUT_CLASS}><option value="trade_license">Trade License / CR</option><option value="national_id">ID</option></select></VendorFormField>
          <VendorFormField label={documentType==='trade_license'?'Trade License / CR number':'ID number'} htmlFor={documentType==='trade_license'?'trade_license':'national_id_number'}>
            <Input key={documentType} id={documentType==='trade_license'?'trade_license':'national_id_number'} name={documentType==='trade_license'?'trade_license':'national_id_number'} maxLength={100} value={numbers[documentType]} onChange={e=>setNumbers(current=>({...current,[documentType]:e.target.value}))} disabled={isPending} className={VENDOR_FORM_INPUT_CLASS}/>
          </VendorFormField>
          <VendorFormField label="Document expiry" htmlFor="legal_document_expiry"><Input id="legal_document_expiry" name="legal_document_expiry" type="date" defaultValue={value('legal_document_expiry')} disabled={isPending} className={VENDOR_FORM_INPUT_CLASS}/></VendorFormField>
          {([['vat_number','VAT number'],['tax_id','Tax ID']] as const).map(([key,label])=><VendorFormField key={key} label={label} htmlFor={key}><Input id={key} name={key} maxLength={100} defaultValue={value(key)||(key==='tax_id'?vendor.tax_registration_number??'':'')} disabled={isPending} className={VENDOR_FORM_INPUT_CLASS}/></VendorFormField>)}
        </VendorFormGrid>
        <div className="mt-4 grid gap-3"><VendorLegalAttachment vendor={vendor} type={documentType} label={documentType==='trade_license'?'Trade License / CR':'ID'}/><VendorLegalAttachment vendor={vendor} type="tax_document" label="tax certificate"/></div>
      </VendorFormSection>
      <VendorFormSection icon={MapPinIcon} title="Registered address" description="Legal address for registration and invoicing."><VendorFormGrid className="lg:grid-cols-3">
        {([['legal_address_line1','Address line 1'],['legal_address_line2','Address line 2'],['legal_address_city','City'],['legal_address_country','Country'],['legal_address_postal_code','Postal code']] as const).map(([key,label])=><VendorFormField key={key} label={label} htmlFor={key}><Input id={key} name={key} defaultValue={value(key)} disabled={isPending} className={VENDOR_FORM_INPUT_CLASS}/></VendorFormField>)}
      </VendorFormGrid></VendorFormSection>
      <VendorFormSection
        icon={ScaleIcon}
        title="Legal & contract"
        description="Contract status, expiry and exclusivity terms."
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
      <VendorAgencyCard vendor={vendor} disabled={isPending}/>
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
