"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspaceActor } from "@/lib/security/workspace-actor";
import { parseSendRecipientsJson } from "@/lib/io/client-io-send-recipients";
import { uniqueRecipientSuggestions, type RecipientSuggestion } from "@/lib/io/recipient-suggestions";

/** Read saved contacts and IO recipients using the caller's normal row permissions. */
export async function loadIoRecipientSuggestions(): Promise<RecipientSuggestion[]> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (await resolveWorkspaceActor(supabase, user.id)).kind !== "internal") {
    throw new Error("Unauthorized");
  }
  const suggestions: RecipientSuggestion[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("client_ios")
      .select("id, send_recipients").order("updated_at", { ascending: false }).order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Could not load saved IO recipients.");
    for (const row of (data ?? []) as Array<{ send_recipients: unknown }>) suggestions.push(...parseSendRecipientsJson(row.send_recipients));
    if (!data || data.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("client_contacts")
      .select("id, full_name, email").order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load saved contacts.");
    for (const row of (data ?? []) as Array<{ full_name: string | null; email: string | null }>) suggestions.push({ name: row.full_name ?? "", email: row.email ?? "" });
    if (!data || data.length < 500) break;
  }
  return uniqueRecipientSuggestions(suggestions);
}
