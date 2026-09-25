"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planningDb } from "@/lib/supabase/governance-client";
import { requirePermission } from "@/lib/auth/permissions-server";

const schema = z.object({
  kind: z.enum(["contact", "due"]),
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Enter a valid date."),
  notes: z.string().trim().max(1000),
});

export async function saveCollectionFollowUp(input: z.infer<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid date and a note of at most 1,000 characters." };
  const db = await createSupabaseServerClient();
  const auth = await requirePermission(db, "collections.write");
  if ("error" in auth) return { ok: false, error: auth.error };
  const { kind, id, date, notes } = parsed.data;
  if (kind === "contact" && date > new Date().toISOString().slice(0, 10)) return { ok: false, error: "Contact cannot be recorded in the future." };
  const { data: target, error: targetError } = await db.from(kind === "contact" ? "invoices" : "campaign_influencers").select("id").eq("id", id).maybeSingle();
  if (targetError || !target) return { ok: false, error: "The selected record is unavailable. Reload Collections and try again." };
  const { error } = await planningDb(db).from("collection_audit_logs").insert({
    entity_type: kind === "contact" ? "invoice" : "assignment", entity_id: id,
    action: kind === "contact" ? "contact_recorded" : "payable_due_date_set", actor_id: auth.userId,
    metadata: kind === "contact" ? { contact_at: date, notes, channel: "manual" } : { due_date: date, notes },
  });
  if (error) return { ok: false, error: "Could not save the follow-up. Check your Collections access and retry." };
  revalidatePath("/collections");
  return { ok: true };
}

export async function reviseCollectionPayment(input: { id: string; revision: number; amount: number; date: string; method: string; reference: string; notes: string; reason: string }) {
 const db = await createSupabaseServerClient(); const auth = await requirePermission(db, "collections.write");
 if ("error" in auth) return {ok:false,error:auth.error};
 const parsed = z.object({id:z.string().uuid(),revision:z.number().int().min(0),amount:z.number().positive().finite(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),method:z.string(),reference:z.string().max(120),notes:z.string().max(2000),reason:z.string().trim().min(1).max(500)}).safeParse(input);
 if (!parsed.success) return {ok:false,error:"Check the payment details and enter a correction reason."};
 const {error}=await planningDb(db).rpc("revise_collection_payment",{p_id:input.id,p_revision:input.revision,p_amount:input.amount,p_date:input.date,p_method:input.method,p_reference:input.reference,p_notes:input.notes,p_reason:input.reason});
 if(error) return {ok:false,error:"Could not save the correction. Refresh and check the invoice balance, payment date and your payment-edit permission."};
 for(const path of ["/collections","/billing","/treasury","/"]) revalidatePath(path);
 return {ok:true};
}

export async function deleteCollectionPayment(input: {id: string; revision: number; reason: string}) {
 const db = await createSupabaseServerClient();
 const auth = await requirePermission(db, "collections.write");
 if ("error" in auth) return {ok:false,error:auth.error};
 const parsed = z.object({id:z.string().uuid(),revision:z.number().int().min(0),reason:z.string().trim().min(1).max(500)}).safeParse(input);
 if (!parsed.success) return {ok:false,error:"Enter a reason for deleting this payment."};
 const {error} = await planningDb(db).rpc("delete_collection_payment",{p_id:parsed.data.id,p_revision:parsed.data.revision,p_reason:parsed.data.reason});
 if (error) return {ok:false,error:"Could not delete the payment. Refresh and check your permissions and whether this payment has changed or needs allocation reconciliation."};
 for (const path of ["/collections","/billing","/treasury","/"]) revalidatePath(path);
 return {ok:true};
}
