"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS } from "@/features/quotations/constants";
import { createVendorAction } from "@/features/vendors/actions";
import { addItemsToQuotation } from "@/lib/services/quotations/quotation-service";
import { createCampaignLine } from "@/lib/services/campaigns/campaign-line-service";
import { otherServicePlatforms, otherServiceSeed } from "@/lib/commercial/other-service";
import { isCommercialCurrency } from "@/lib/commercial/fx-aggregation";

const scopeSchema = z.enum(["quotation", "campaign"]);
const serviceSchema = z.object({
  scope: scopeSchema, documentId: z.string().uuid(), vendorId: z.string().uuid(),
  title: z.string().trim().min(1).max(200), description: z.string().trim().max(1800),
  cost: z.number().finite().min(0), revenue: z.number().finite().min(0),
  currency: z.string().refine(isCommercialCurrency, "Unsupported currency"),
  agencyFeePercent: z.number().finite().min(0).max(100),
});

async function actor(scope: "quotation" | "campaign") {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, scope === "quotation" ? QUOTATION_PERMISSIONS.write : "campaigns.write");
  return { supabase, auth };
}

export async function searchOtherServiceVendors(scope: "quotation" | "campaign", search: string) {
  if (!scopeSchema.safeParse(scope).success) return { ok: false as const, message: "Invalid workspace." };
  const { supabase, auth } = await actor(scope);
  if ("error" in auth) return { ok: false as const, message: auth.error };
  const query = supabase.from("influencers").select("id, display_name, document_number")
    .in("status", ["active", "prospect"]).order("display_name").limit(30);
  const term = String(search ?? "").trim().slice(0, 100).replace(/[%_\\]/g, " ");
  const { data, error } = await (term ? query.ilike("display_name", `%${term}%`) : query);
  return error ? { ok: false as const, message: error.message } : { ok: true as const, vendors: data ?? [] };
}

export async function createOtherServiceVendor(input: { name: string; email: string; country: string }) {
  const supabase = await createSupabaseServerClient();
  const permission = await requirePermission(supabase, "influencers.write");
  if ("error" in permission) return { ok: false as const, message: permission.error };
  const form = new FormData();
  form.set("display_name", input.name);
  form.set("email", input.email);
  form.set("country_code", input.country);
  form.set("categories", "Other services");
  form.set("status", "active");
  return createVendorAction({ ok: false }, form);
}

export async function addOtherService(input: z.input<typeof serviceSchema>) {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Check the service details." };
  const service = parsed.data;
  const { supabase, auth } = await actor(service.scope);
  if ("error" in auth) return { ok: false as const, message: auth.error };
  const { data: vendor, error } = await supabase.from("influencers").select("id, display_name, status")
    .eq("id", service.vendorId).maybeSingle();
  if (error || !vendor || !["active", "prospect"].includes(vendor.status)) {
    return { ok: false as const, message: error?.message ?? "Select an active vendor." };
  }
  const seed = otherServiceSeed(service, vendor.display_name);
  if (service.scope === "quotation") {
    const result = await addItemsToQuotation(supabase, service.documentId, [seed]);
    if (!result.ok) return result;
    revalidatePath("/discovery/quotations");
    revalidatePath(`/discovery/quotations/${service.documentId}`);
    return { ok: true as const, message: "Other service added.", id: result.data?.itemIds[0] };
  }
  const result = await createCampaignLine(supabase, auth.userId, {
    campaign_id: service.documentId, influencer_id: service.vendorId,
    name: service.title, description: seed.service_description, title_user_edited: true,
    assignment_json: JSON.stringify({ platforms: otherServicePlatforms(vendor.display_name) }),
    pricing_mode: "package", platform: "other", cost: service.cost, revenue: service.revenue,
    cost_before_vat: service.cost, revenue_before_vat: service.revenue,
    po_amount: Math.round(service.revenue * (1 + service.agencyFeePercent / 100) * 100) / 100,
    usage_rights_amount: 0, usage_rights_cost: 0, agency_fee_percent: service.agencyFeePercent,
    revenue_vat_percent: 0, cost_vat_percent: -1, currency_code: service.currency,
    start_date: null, end_date: null, assignment_status: "assigned",
  });
  if (!result.ok) return result;
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${service.documentId}`);
  return { ok: true as const, message: "Other service assignment added.", id: result.lineId };
}
