import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import { loadVendorPayables } from "@/lib/vendor-payables/load-payables";
import type { CollectionsPageData } from "./redesign-data";
import { planningDb } from "@/lib/supabase/governance-client";

export async function loadCollectionsRedesign(): Promise<CollectionsPageData> {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Sign in to view Collections.");
  const asOf = new Date().toISOString();
  const [invoices, payables, clients, receipts, history, ios, assignments] = await Promise.allSettled([
    loadCollectionInvoices(db),
    loadVendorPayables(db),
    db.from("clients").select("id, name").order("name"),
    db.from("payments").select("client_id, currency, amount, paid_at").eq("status", "completed").gte("paid_at", `${asOf.slice(0, 7)}-01T00:00:00Z`),
    planningDb(db).from("collection_audit_logs").select("entity_id, action, metadata, created_at").in("action", ["contact_recorded", "payable_due_date_set"]).order("created_at", { ascending: false }).limit(5000),
    planningDb(db).from("vendor_ios").select("id, assignment_id").order("created_at", { ascending: false }),
    db.from("campaign_influencers").select("id, campaign:campaign_headers!campaign_influencers_campaign_header_id_fkey(client_id)"),
  ]);
  const warnings: string[] = [];
  if (invoices.status === "rejected") warnings.push("Invoice balances are unavailable. Reload Collections to retry; if this continues, ask Finance to check invoice access.");
  if (payables.status === "rejected") warnings.push("Vendor payable balances are unavailable. Reload Collections to retry; if this continues, ask Finance to check assignment access.");
  if (clients.status === "rejected" || clients.value.error) warnings.push("Client details are unavailable. Reload to restore the client selector.");
  if (receipts.status === "rejected" || receipts.value.error) warnings.push("This month's receipts are unavailable. Reload to restore collection activity.");
  const contacts: Record<string, string> = {}, dueDates: Record<string, string> = {}, vendorIos: Record<string, string> = {}, assignmentClients: Record<string, string> = {};
  if (history.status === "fulfilled" && !history.value.error) {
    for (const entry of history.value.data ?? []) {
      if (entry.action === "contact_recorded") {
        const contactAt = entry.metadata?.contact_at ?? entry.created_at;
        if (!contacts[entry.entity_id] || contactAt > contacts[entry.entity_id]) contacts[entry.entity_id] = contactAt;
      }
      if (entry.action === "payable_due_date_set" && !dueDates[entry.entity_id]) dueDates[entry.entity_id] = entry.metadata?.due_date;
    }
  } else warnings.push("Contact history and payable due dates are unavailable. Reload to restore saved follow-up details.");
  if (ios.status === "fulfilled") for (const io of ios.value.data ?? []) if (io.assignment_id && !vendorIos[io.assignment_id]) vendorIos[io.assignment_id] = io.id;
  if (assignments.status === "fulfilled") for (const row of assignments.value.data ?? []) {
    const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign;
    if (campaign?.client_id) assignmentClients[row.id] = campaign.client_id;
  }
  return {
    asOf,
    invoices: invoices.status === "fulfilled" ? invoices.value : [],
    payables: payables.status === "fulfilled" ? payables.value.rows : [],
    clients: clients.status === "fulfilled" ? clients.value.data ?? [] : [],
    receipts: receipts.status === "fulfilled" ? (receipts.value.data ?? []).map(r => ({ ...r, amount: Number(r.amount) })) : [],
    warnings,
    contacts, dueDates, vendorIos, assignmentClients,
  };
}
