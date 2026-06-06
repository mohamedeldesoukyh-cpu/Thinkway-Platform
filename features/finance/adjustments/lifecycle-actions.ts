"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdjustmentTableKind } from "@/lib/finance/adjustment-table-config";
import {
  approveFinanceAdjustment,
  cancelFinanceAdjustment,
  postFinanceAdjustment,
  reopenFinanceAdjustment,
  unpostFinanceAdjustment,
} from "@/lib/finance/status/adjustment-lifecycle";
import type { FinanceAdjustmentActionState } from "@/features/finance/adjustments/actions";

const lifecycleSchema = z.object({
  kind: z.enum([
    "client_credit_note",
    "vendor_credit_note",
    "client_debit_note",
    "vendor_debit_note",
  ]),
  id: z.string().uuid(),
  reason: z.string().trim().optional(),
});

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Unauthorized");
  return { supabase, user };
}

function revalidateAdjustmentPaths(kind: AdjustmentTableKind) {
  const pathMap: Record<AdjustmentTableKind, string> = {
    client_credit_note: "/finance/client-credit-notes",
    vendor_credit_note: "/finance/vendor-credit-notes",
    client_debit_note: "/finance/client-debit-notes",
    vendor_debit_note: "/finance/vendor-debit-notes",
  };
  revalidatePath(pathMap[kind]);
  revalidatePath("/finance/posting-center");
}

async function runLifecycle(
  action: "approve" | "post" | "cancel" | "reopen" | "unpost",
  formData: FormData
): Promise<FinanceAdjustmentActionState> {
  try {
    const parsed = lifecycleSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { ok: false, message: "Invalid adjustment request." };
    }

    const { supabase, user } = await requireUser();
    const ctx = {
      supabase,
      kind: parsed.data.kind,
      id: parsed.data.id,
      actorId: user.id,
      reason: parsed.data.reason,
    };

    const result =
      action === "approve"
        ? await approveFinanceAdjustment(ctx)
        : action === "post"
          ? await postFinanceAdjustment(ctx)
          : action === "cancel"
            ? await cancelFinanceAdjustment(ctx)
            : action === "reopen"
              ? await reopenFinanceAdjustment(ctx)
              : await unpostFinanceAdjustment(ctx);

    if (!result.ok) {
      return { ok: false, message: result.error };
    }

    revalidateAdjustmentPaths(parsed.data.kind);
    return {
      ok: true,
      message: `Adjustment ${result.document_number} → ${result.status}.`,
      document_number: result.document_number,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected error.",
    };
  }
}

export async function approveAdjustmentAction(
  _prev: FinanceAdjustmentActionState,
  formData: FormData
) {
  return runLifecycle("approve", formData);
}

export async function postAdjustmentAction(
  _prev: FinanceAdjustmentActionState,
  formData: FormData
) {
  return runLifecycle("post", formData);
}

export async function cancelAdjustmentAction(
  _prev: FinanceAdjustmentActionState,
  formData: FormData
) {
  return runLifecycle("cancel", formData);
}

export async function reopenAdjustmentAction(
  _prev: FinanceAdjustmentActionState,
  formData: FormData
) {
  return runLifecycle("reopen", formData);
}

export async function unpostAdjustmentAction(
  _prev: FinanceAdjustmentActionState,
  formData: FormData
) {
  return runLifecycle("unpost", formData);
}
