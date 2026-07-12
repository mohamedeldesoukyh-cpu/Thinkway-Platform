"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS, quotationDetailPath } from "@/lib/domains/commercial/quotation-constants";
import { importTentativeScheduleFromCampaignPlan } from "@/lib/services/quotations/import-tentative-schedule-from-campaign-plan";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const importTentativeScheduleSchema = z.object({
  quotationId: z.string().uuid(),
  campaignObjectId: z.string().uuid().optional(),
  anchorStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type ImportTentativeScheduleFromPlanInput = z.infer<
  typeof importTentativeScheduleSchema
>;

export type ImportTentativeScheduleFromPlanResult =
  | {
      ok: true;
      matchedItemCount: number;
      updatedDeliverableCount: number;
      message: string;
    }
  | { ok: false; message: string };

/** Internal-only — used by Phase 3 service; quotation generation applies schedule during mapping. */
export async function importTentativeScheduleFromPlanAction(
  input: ImportTentativeScheduleFromPlanInput
): Promise<ImportTentativeScheduleFromPlanResult> {
  const parsed = importTentativeScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid input for tentative schedule import." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    return { ok: false, message: "You need quotation write access to import tentative schedule." };
  }

  const result = await importTentativeScheduleFromCampaignPlan(
    supabase,
    auth.userId,
    parsed.data
  );
  if (!result.ok) return result;

  revalidatePath(quotationDetailPath(parsed.data.quotationId));

  return result;
}
