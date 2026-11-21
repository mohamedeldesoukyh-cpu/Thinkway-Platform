import { computeAgencyFeeAmount } from '@/lib/assignments/client-billing-commercial';
/** Freeze commercial proportions when billing; partial invoices and FX retain the same split. */
export function invoiceAccountingWeights(row:{revenue_before_vat?:number|null;revenue?:number|null;usage_rights_amount?:number|null;agency_fee_amount?:number|null;agency_fee_percent?:number|null}){
 const revenue=Math.max(0,Number(row.revenue_before_vat??row.revenue??0)),ur=Math.max(0,Number(row.usage_rights_amount??0));
 const af=Number(row.agency_fee_amount??0)>0?Number(row.agency_fee_amount):computeAgencyFeeAmount(revenue,ur,Number(row.agency_fee_percent??0));
 return revenue+ur+af>0?{assignment_revenue:revenue,usage_rights_revenue:ur,agency_fee:af}:null;
}
