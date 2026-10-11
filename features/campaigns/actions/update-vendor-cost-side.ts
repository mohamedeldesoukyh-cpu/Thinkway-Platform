"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readCreatorFx } from "@/lib/commercial/creator-fx";
import type { UpdateAssignmentLineCommercialsResult } from "./update-assignment-line-commercials";

const schema = z.object({
  campaignId: z.string().uuid(), lineId: z.string().uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  cost: z.number().finite().min(0), usageCost: z.number().finite().min(0),
  vat: z.number().finite().min(0).max(100),
  fx: z.string().max(400).nullable().refine(v => v === null || readCreatorFx(v) !== null),
});

export async function updateVendorCostSideAction(input: z.infer<typeof schema>): Promise<UpdateAssignmentLineCommercialsResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a valid currency, cost, VAT and positive FX rate." };
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to edit vendor costs." };
  const p = parsed.data;
  const { error } = await db.rpc("update_reopened_vendor_cost_side" as never, {
    p_campaign: p.campaignId, p_line: p.lineId, p_currency: p.currency,
    p_cost: p.cost, p_usage_cost: p.usageCost, p_vat: p.vat, p_fx: p.fx,
  } as never);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/campaigns", "layout");
  revalidatePath("/ios/vendor", "layout");
  return { ok: true, updated: 1, message: "Cost currency, amount, VAT and FX saved. Vendor payable and profitability updated. Generate the revised Vendor IO." };
}
