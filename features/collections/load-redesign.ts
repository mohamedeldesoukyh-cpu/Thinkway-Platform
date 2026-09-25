import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import type { CollectionsPageData } from "./redesign-data";
import { planningDb } from "@/lib/supabase/governance-client";

export async function loadCollectionsRedesign(): Promise<CollectionsPageData> {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Sign in to view Collections.");
  const asOf = new Date().toISOString();
  const [invoices, clients, receipts, history, paymentHistory, campaigns] = await Promise.allSettled([
    loadCollectionInvoices(db),
    db.from("clients").select("id, name, document_number").order("name"),
    db.from("payments").select("client_id, currency, amount, paid_at").eq("status", "completed").gte("paid_at", `${asOf.slice(0, 7)}-01T00:00:00Z`),
    planningDb(db).from("collection_audit_logs").select("entity_id, action, metadata, created_at").in("action", ["contact_recorded", "payment_deleted"]).order("created_at", { ascending: false }).limit(5000),
    planningDb(db).from("payments").select("id,document_number,invoice_id,client_id,amount,currency,paid_at,payment_method,reference_number,notes,status,revision,advance_campaign_id,advance_source_id,created_at").order("paid_at", {ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1000),
    db.from("campaign_headers").select("id,name,document_number,client_id").order("name"),
  ]);
  const warnings: string[] = [];
  if (invoices.status === "rejected") warnings.push("Invoice balances are unavailable. Reload Collections to retry; if this continues, ask Finance to check invoice access.");
  if (clients.status === "rejected" || clients.value.error) warnings.push("Client details are unavailable. Reload to restore the client selector.");
  if (receipts.status === "rejected" || receipts.value.error) warnings.push("This month's receipts are unavailable. Reload to restore collection activity.");
  const deletedPayments = new Set<string>();
  const contacts: Record<string, string> = {};
  if (history.status === "fulfilled" && !history.value.error) {
    for (const entry of history.value.data ?? []) {
      if (entry.action === "payment_deleted") deletedPayments.add(entry.entity_id);
      if (entry.action === "contact_recorded") {
        const contactAt = entry.metadata?.contact_at ?? entry.created_at;
        if (!contacts[entry.entity_id] || contactAt > contacts[entry.entity_id]) contacts[entry.entity_id] = contactAt;
      }
    }
  } else warnings.push("Contact history is unavailable. Reload to restore saved follow-up details.");
  if(paymentHistory.status === "rejected" || paymentHistory.value.error) warnings.push("Payment history is unavailable. Reload or check payment read access.");
  if(campaigns.status === "rejected" || campaigns.value.error) warnings.push("Campaign choices are unavailable. Reload before linking an advance.");
  return {
    asOf,
    campaigns: campaigns.status === "fulfilled" ? campaigns.value.data ?? [] : [],
    invoices: invoices.status === "fulfilled" ? invoices.value : [],
    clients: clients.status === "fulfilled" ? clients.value.data ?? [] : [],
    receipts: receipts.status === "fulfilled" ? (receipts.value.data ?? []).map(r => ({ ...r, amount: Number(r.amount) })) : [],
    warnings,
    contacts,
    paymentHistory: paymentHistory.status === "fulfilled" ? (paymentHistory.value.data ?? []).map(r=>({...r,amount:Number(r.amount),can_restore:r.status==="cancelled" && deletedPayments.has(r.id)})) : [],
  };
}
