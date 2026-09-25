"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planningDb } from "@/lib/supabase/governance-client";
import { requirePermission } from "@/lib/auth/permissions-server";

const advanceSchema = z.object({request:z.string().uuid(),client:z.string().uuid(),campaign:z.string().uuid().nullable(),amount:z.number().finite().positive(),currency:z.enum(["EGP","AED","USD","SAR","EUR","GBP"]),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),method:z.enum(["bank_transfer","wire","check","credit_card","debit_card","paypal","other"]),reference:z.string().max(120),notes:z.string().max(2000)});
const settleSchema=z.object({id:z.string().uuid(),invoice:z.string().uuid(),amount:z.number().positive().finite(),revision:z.number().int().nonnegative()});
function refresh(){for(const path of ["/collections","/billing","/treasury","/campaigns","/"])revalidatePath(path);}
export async function recordClientAdvance(input:z.infer<typeof advanceSchema>){
 const parsed=advanceSchema.safeParse(input);if(!parsed.success)return{ok:false,error:"Check the client, currency and advance details."};
 const db=await createSupabaseServerClient();const auth=await requirePermission(db,"collections.write");if("error"in auth)return{ok:false,error:auth.error};
 const p=parsed.data;const {error}=await planningDb(db).rpc("record_collection_advance",{p_request:p.request,p_client:p.client,p_campaign:p.campaign,p_amount:p.amount,p_currency:p.currency,p_date:p.date,p_method:p.method,p_reference:p.reference,p_notes:p.notes});
 if(error)return{ok:false,error:"Could not save the advance. Check the date and that the campaign belongs to this client, then retry."};refresh();return{ok:true};
}
export async function settleClientAdvance(input:z.infer<typeof settleSchema>){
 const parsed=settleSchema.safeParse(input);if(!parsed.success)return{ok:false,error:"Select an invoice and a valid amount."};
 const db=await createSupabaseServerClient();const auth=await requirePermission(db,"collections.write");if("error"in auth)return{ok:false,error:auth.error};
 const p=parsed.data;const {error}=await planningDb(db).rpc("settle_collection_advance",{p_id:p.id,p_invoice:p.invoice,p_amount:p.amount,p_revision:p.revision});
 if(error)return{ok:false,error:"Could not settle the advance. Reload and choose an active, unsettled invoice for the same client, currency and linked campaign. The amount cannot exceed either balance."};refresh();return{ok:true};
}
