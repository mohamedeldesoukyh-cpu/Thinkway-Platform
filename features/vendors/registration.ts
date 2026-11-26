import { z } from 'zod';
const text=(max=200)=>z.string().trim().max(max).optional();
const date=z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),'Enter a valid date').optional();
export const vendorAgencyShape={
 has_management_agency:z.enum(['true','false']).optional(),
 agency_name:text(),agency_contact_name:text(),agency_email:z.union([z.literal(''),z.string().email()]).optional(),
 agency_phone:text(80),agency_address:text(500),agency_registration_number:text(100),agency_tax_number:text(100),
};
export const vendorRegistrationShape={
 legal_document_type:z.enum(['trade_license','national_id']).optional(),national_id_number:text(100),
 legal_document_expiry:date,legal_address_line1:text(500),legal_address_line2:text(500),legal_address_city:text(120),
 legal_address_country:text(120),legal_address_postal_code:text(40),vat_number:text(100),tax_id:text(100),
 ...vendorAgencyShape,
};
export function mergeVendorRegistrationMetadata(current:Record<string,unknown>|null|undefined,data:Record<string,unknown>){
 const next={...current};
 for(const key of [...Object.keys(vendorRegistrationShape),'trade_license']) {
   if(data[key]!==undefined) next[key]=key==='has_management_agency'?data[key]==='true':(data[key]||null);
 }
 return next;
}
