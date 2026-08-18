"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { isValidClientIoEmail } from "@/lib/io/client-io-send-recipients";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientReviewRecipient = {
  id: string;
  label: string;
  email: string;
};

export async function loadClientReviewRecipientsAction(input: {
  clientId: string;
}): Promise<{ ok: true; recipients: ClientReviewRecipient[] } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in adminAuth) return { ok: false, message: auth.error };
  }

  const [contactsResult, clientResult] = await Promise.all([
    supabase
      .from("client_contacts")
      .select("id, full_name, email, is_primary")
      .eq("client_id", input.clientId)
      .order("is_primary", { ascending: false })
      .order("full_name"),
    supabase.from("clients").select("billing_email, name").eq("id", input.clientId).maybeSingle(),
  ]);
  if (contactsResult.error) return { ok: false, message: contactsResult.error.message };
  if (clientResult.error) return { ok: false, message: clientResult.error.message };

  const recipients: ClientReviewRecipient[] = [];
  const seen = new Set<string>();
  for (const contact of (contactsResult.data ?? []) as Array<{
    id: string;
    full_name: string;
    email: string | null;
    is_primary: boolean;
  }>) {
    const email = String(contact.email ?? "").trim();
    if (!email || !isValidClientIoEmail(email) || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    recipients.push({
      id: String(contact.id),
      label: contact.is_primary ? `${contact.full_name} (Primary)` : contact.full_name,
      email,
    });
  }
  const clientRow = clientResult.data as { billing_email: string | null; name: string } | null;
  const billingEmail = String(clientRow?.billing_email ?? "").trim();
  if (billingEmail && isValidClientIoEmail(billingEmail) && !seen.has(billingEmail.toLowerCase())) {
    recipients.unshift({
      id: "billing-email",
      label: `${clientRow?.name ?? "Client"} billing`,
      email: billingEmail,
    });
  }
  return { ok: true, recipients };
}
