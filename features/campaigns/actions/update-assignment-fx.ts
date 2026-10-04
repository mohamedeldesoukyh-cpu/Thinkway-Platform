"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readCreatorFx } from "@/lib/commercial/creator-fx";

const override = z.string().max(400).nullable().refine(value => value === null || readCreatorFx(value) !== null);
const schema = z.object({
  campaignId: z.string().uuid(), lineId: z.string().uuid(),
  costOverride: override, revenueOverride: override,
  expectedCostOverride: override, expectedRevenueOverride: override,
  currency: z.string().regex(/^[A-Z]{3}$/), costCurrency: z.string().regex(/^[A-Z]{3}$/),
});

/** Assignment reporting FX is independent from native commercial amounts and posted invoices. */
export async function updateAssignmentFxAction(input: z.infer<typeof schema>): Promise<{ ok: boolean; message: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter valid positive FX rates." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to edit assignment FX." };
  const p = parsed.data;
  const { data, error } = await supabase.rpc("update_assignment_reporting_fx", {
    p_campaign_id: p.campaignId, p_line_id: p.lineId,
    p_cost_override: p.costOverride, p_revenue_override: p.revenueOverride,
    p_expected_cost_override: p.expectedCostOverride, p_expected_revenue_override: p.expectedRevenueOverride,
    p_expected_currency: p.currency, p_expected_cost_currency: p.costCurrency,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/campaigns", "layout");
  revalidatePath("/ios/client");
  revalidatePath("/billing", "layout");
  revalidatePath("/finance/invoices");
  return { ok: true, message: Number(data) > 0
    ? "FX saved. Uninvoiced billing uses the updated revenue rate. The Client IO requires a revised version because its client-facing amount changed. Existing invoices are unchanged."
    : "FX saved. Uninvoiced billing uses the updated revenue rate. Client IO revision is not required for this FX change. Existing invoices are unchanged." };
}
