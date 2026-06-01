"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { governanceDb } from "@/lib/supabase/governance-client";

import { updateFinancialPeriodSchema } from "@/features/operations/schemas";

export type FinanceActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function updateFinancialPeriodAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const parsed = updateFinancialPeriodSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "finance.periods");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  let periodId = parsed.data.period_id || null;

  if (!periodId) {
    const { data: existing } = await governanceDb(supabase)
      .from("financial_periods")
      .select("id, status")
      .eq("year", parsed.data.year)
      .eq("month", parsed.data.month)
      .maybeSingle();

    if (existing) {
      periodId = existing.id;
    } else {
      const { data: created, error: createError } = await governanceDb(supabase)
        .from("financial_periods")
        .insert({
          year: parsed.data.year,
          month: parsed.data.month,
          status: parsed.data.status,
          locked_by: parsed.data.status !== "open" ? auth.userId : null,
          locked_at: parsed.data.status !== "open" ? new Date().toISOString() : null,
          notes: parsed.data.reason,
        })
        .select("id")
        .single();

      if (createError || !created) {
        return { ok: false, message: createError?.message ?? "Failed to create period." };
      }

      await governanceDb(supabase).from("period_lock_logs").insert({
        period_id: created.id,
        previous_status: null,
        new_status: parsed.data.status,
        reason: parsed.data.reason,
        actor_id: auth.userId,
      });

      revalidatePath("/finance/periods");
      return {
        ok: true,
        message: `Period ${parsed.data.year}-${String(parsed.data.month).padStart(2, "0")} set to ${parsed.data.status.replace("_", " ")}.`,
      };
    }
  }

  const { data: period, error: fetchError } = await governanceDb(supabase)
    .from("financial_periods")
    .select("id, status")
    .eq("id", periodId!)
    .maybeSingle();

  if (fetchError || !period) {
    return { ok: false, message: "Period not found." };
  }

  const previousStatus = period.status;

  const { error: updateError } = await governanceDb(supabase)
    .from("financial_periods")
    .update({
      status: parsed.data.status,
      locked_by: parsed.data.status !== "open" ? auth.userId : null,
      locked_at: parsed.data.status !== "open" ? new Date().toISOString() : null,
      notes: parsed.data.reason,
    })
    .eq("id", period.id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await governanceDb(supabase).from("period_lock_logs").insert({
    period_id: period.id,
    previous_status: previousStatus,
    new_status: parsed.data.status,
    reason: parsed.data.reason,
    actor_id: auth.userId,
  });

  revalidatePath("/finance/periods");
  return {
    ok: true,
    message: `Period updated to ${parsed.data.status.replace("_", " ")}.`,
  };
}
