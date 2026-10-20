"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS } from "./constants";

export type CreatorQuotationHistoryLine = {
  id: string;
  quotation_id: string;
  cost: number;
  cost_currency: string;
  created_at: string;
  quotations: {
    serial_number: string | null;
    name: string;
    status: string;
    is_archived: boolean;
    temporary_client_name: string | null;
    temporary_brand_name: string | null;
    client: { name: string } | null;
    brand: { name: string } | null;
    campaign: { name: string } | null;
  };
};

export async function getCreatorQuotationHistory(influencerId: string): Promise<
  { ok: true; lines: CreatorQuotationHistoryLine[]; count: number } |
  { ok: false; message: string }
> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.read);
  if ("error" in auth) return { ok: false, message: auth.error };
  if (!/^[0-9a-f-]{36}$/i.test(influencerId)) return { ok: false, message: "Invalid creator." };
  try {
    const lines: CreatorQuotationHistoryLine[] = [];
    // Fetch every line, including zero-cost and archived quotations, beyond the API row limit.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("quotation_items").select(`
        id, quotation_id, cost, cost_currency, created_at,
        quotations!inner(serial_number, name, status, is_archived,
          temporary_client_name, temporary_brand_name,
          client:clients(name), brand:brands(name), campaign:campaign_headers(name))
      `).eq("influencer_id", influencerId)
        .order("created_at", { ascending: false }).order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      const page = (data ?? []) as unknown as CreatorQuotationHistoryLine[];
      lines.push(...page);
      if (page.length < 500) break;
    }
    return { ok: true, lines, count: new Set(lines.map(line => line.quotation_id)).size };
  } catch {
    return { ok: false, message: "Could not load quotation history. Please try again." };
  }
}
