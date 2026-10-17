"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import { loadCampaignRevenueShare } from "@/lib/services/campaigns/campaign-revenue-share";

export async function getCampaignRevenueShareAction(campaignId: string) {
  try {
    if (!z.string().uuid().safeParse(campaignId).success) throw new Error("Invalid campaign.");
    const supabase = await createSupabaseServerClient();
    const auth = await requirePermission(supabase, "campaigns.read");
    if ("error" in auth) throw new Error(auth.error);
    const data = await loadCampaignRevenueShare(supabase, campaignId);
    return { ok: true as const, data: { id: data.header.id, name: data.header.name,
      document_number: data.header.document_number, currency: data.header.currency_code,
      updated_at: data.header.updated_at as string, share: data.share, amount: data.amount,
      revenue: data.financials.revenue, cost: data.financials.revenue - data.financials.gp,
      gp: data.financials.gp } };
  } catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Unable to load revenue share." }; }
}

const schema = z.object({ campaignId: z.string().uuid(), mode: z.enum(["amount", "percent"]),
  value: z.number().finite().min(0).max(1e12), currency: z.string().regex(/^[A-Z]{3}$/), updated_at: z.string().min(1) });

export async function saveCampaignRevenueShareAction(input: z.infer<typeof schema>) {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error("Enter a valid non-negative revenue share.");
    const supabase = await createSupabaseServerClient();
    const auth = await requirePermission(supabase, "campaigns.write");
    if ("error" in auth) throw new Error(auth.error);
    const { campaignId, mode, value, currency, updated_at } = parsed.data;
    const current = await loadCampaignRevenueShare(supabase, campaignId);
    if (current.header.updated_at !== updated_at) throw new Error("Campaign changed. Close and reopen revenue share before saving.");
    if (currency !== current.header.currency_code) throw new Error("Campaign currency changed. Reopen revenue share.");
    if (value > 0 && current.financials.revenue <= 0) throw new Error("Add campaign revenue before setting revenue share.");
    const share = { mode, value, currency };
    // Optimistic concurrency protects other campaign metadata from a stale drawer.
    const { data, error } = await supabase.from("campaign_headers").update({
      metadata: { ...current.header.metadata, revenue_share: share },
    }).eq("id", campaignId).eq("updated_at", updated_at).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Campaign changed. Reopen revenue share and try again.");
    await logAuditEvent(supabase, { userId: auth.userId, action: "update", entityType: "campaign_header",
      entityId: campaignId, metadata: { operation: "revenue_share", before: current.share, after: share } });
    revalidatePath("/campaigns", "layout");
    revalidatePath("/reports", "layout");
    return { ok: true as const };
  } catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Unable to save revenue share." }; }
}
