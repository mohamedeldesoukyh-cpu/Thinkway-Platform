"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  regenerateInvoice,
  unpostInvoice,
  voidInvoice,
} from "@/lib/finance/invoice-lifecycle";

export type InvoiceLifecycleActionState = {
  ok: boolean;
  message?: string;
};

const reasonSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().trim().min(3, "Reason is required (min 3 characters)."),
});

async function requireFinanceUser(permission: string) {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, permission);
  if ("error" in auth) {
    return { error: auth.error as string };
  }
  return { supabase, userId: auth.userId };
}

export async function unpostInvoiceAction(
  _prev: InvoiceLifecycleActionState,
  formData: FormData
): Promise<InvoiceLifecycleActionState> {
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.flatten().fieldErrors.reason?.[0] ?? "Invalid request." };
  }

  const auth = await requireFinanceUser("finance.regenerate");
  if ("error" in auth) return { ok: false, message: auth.error };

  const result = await unpostInvoice(auth.supabase, {
    invoice_id: parsed.data.invoice_id,
    actor_id: auth.userId,
    reason: parsed.data.reason,
  });

  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/finance/invoices");
  revalidatePath("/billing");
  revalidatePath(`/billing/invoices/${parsed.data.invoice_id}`);

  return { ok: true, message: result.message };
}

export async function voidInvoiceAction(
  _prev: InvoiceLifecycleActionState,
  formData: FormData
): Promise<InvoiceLifecycleActionState> {
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.flatten().fieldErrors.reason?.[0] ?? "Invalid request." };
  }

  const auth = await requireFinanceUser("finance.regenerate");
  if ("error" in auth) return { ok: false, message: auth.error };

  const result = await voidInvoice(auth.supabase, {
    invoice_id: parsed.data.invoice_id,
    actor_id: auth.userId,
    reason: parsed.data.reason,
  });

  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/finance/invoices");
  revalidatePath("/billing");
  revalidatePath(`/billing/invoices/${parsed.data.invoice_id}`);

  return { ok: true, message: result.message };
}

export async function regenerateInvoiceControlAction(
  _prev: InvoiceLifecycleActionState,
  formData: FormData
): Promise<InvoiceLifecycleActionState> {
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.flatten().fieldErrors.reason?.[0] ?? "Invalid request." };
  }

  const auth = await requireFinanceUser("finance.regenerate");
  if ("error" in auth) return { ok: false, message: auth.error };

  const result = await regenerateInvoice(auth.supabase, {
    invoice_id: parsed.data.invoice_id,
    actor_id: auth.userId,
    reason: parsed.data.reason,
  });

  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/finance/invoices");
  revalidatePath("/billing");
  revalidatePath(`/billing/invoices/${parsed.data.invoice_id}`);

  return { ok: true, message: result.message };
}
