"use client";
import { useVendorUndoState } from "@/features/vendors/components/vendor-undo-state";
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { VendorFormField,VendorFormGrid,VENDOR_FORM_INPUT_CLASS } from './vendor-form-ui';
import type { VendorDetail } from '@/types/database';
export function VendorAgencyCard({vendor,disabled=false}:{vendor:VendorDetail;disabled?:boolean}) {
 const fieldsetId=useId();
 const meta=vendor.metadata??{};
 const [enabled,setEnabled]=useVendorUndoState(typeof meta.has_management_agency==='boolean'?meta.has_management_agency:Boolean(meta.agency_name||vendor.management_agency));
 const value=(key:string)=>typeof meta[key]==='string'?meta[key] as string:'';
 return <div className="border-t border-border pt-4">
   <input type="hidden" name="has_management_agency" value={String(enabled)}/>
   <label className="mb-4 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={enabled} disabled={disabled} onChange={e=>setEnabled(e.target.checked)} aria-controls={fieldsetId}/>Represented by a management agency</label>
   <fieldset id={fieldsetId} disabled={disabled||!enabled} hidden={!enabled} className="min-w-0 disabled:opacity-50">
     <legend className="sr-only">Management agency details</legend>
     <VendorFormGrid className="lg:grid-cols-3">
       {([['agency_name','Agency legal name'],['agency_contact_name','Contact name'],['agency_email','Email'],['agency_phone','Phone'],['agency_registration_number','Trade license / CR'],['agency_tax_number','Tax / VAT number'],['agency_address','Registered address']] as const).map(([key,label])=><VendorFormField key={key} label={label} htmlFor={`${fieldsetId}-${key}`}><Input id={`${fieldsetId}-${key}`} name={key} className={VENDOR_FORM_INPUT_CLASS} type={key==='agency_email'?'email':'text'} maxLength={key==='agency_address'?500:key==='agency_phone'?80:key.endsWith('_number')?100:200} defaultValue={key==='agency_contact_name'?(value(key)||vendor.management_agency||''):value(key)}/></VendorFormField>)}
     </VendorFormGrid>
   </fieldset>
 </div>;
}
