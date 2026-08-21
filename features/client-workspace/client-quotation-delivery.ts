import { isValidClientIoEmail } from "@/lib/io/client-io-send-recipients";
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeClientDeliveryEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!isValidClientIoEmail(trimmed)) return null;
  return trimmed;
}

export async function loadSavedClientEmailsForQuotation(
  supabase: SupabaseClient,
  quotationId: string | null | undefined
): Promise<string[]> {
  if (!quotationId) return [];
  const { data: quote } = await supabase
    .from("quotations" as never)
    .select("client_id")
    .eq("id", quotationId)
    .maybeSingle();
  const clientId = (quote as { client_id?: string | null } | null)?.client_id;
  if (!clientId) return [];
  const [contactsResult, clientResult] = await Promise.all([
    supabase
      .from("client_contacts" as never)
      .select("email, is_primary")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false }),
    supabase.from("clients" as never).select("billing_email").eq("id", clientId).maybeSingle(),
  ]);
  const emails: string[] = [];
  const seen = new Set<string>();
  const billing = String((clientResult.data as { billing_email?: string | null } | null)?.billing_email ?? "").trim();
  if (normalizeClientDeliveryEmail(billing)) {
    seen.add(billing.toLowerCase());
    emails.push(billing);
  }
  for (const contact of (contactsResult.data ?? []) as Array<{ email: string | null }>) {
    const email = String(contact.email ?? "").trim();
    if (!normalizeClientDeliveryEmail(email) || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    emails.push(email);
  }
  return emails;
}
