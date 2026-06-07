import type { SupabaseClient } from "@supabase/supabase-js";

import {
  relockInvoiceOperationalScope,
  unlockInvoiceOperationalScope,
} from "@/lib/billing/invoice-lifecycle-operational";
import { ensureInvoiceFinanceDocument } from "@/lib/finance/finance-document-registry";
import type { InvoiceStatus } from "@/lib/finance/status/invoice-status";

/** Invoice statuses that trigger operational + billing locks. */
export const INVOICE_LOCK_STATUSES: readonly InvoiceStatus[] = [
  "sent",
  "partial",
  "paid",
] as const;

export function shouldLockInvoiceOperationalState(status: string): boolean {
  return INVOICE_LOCK_STATUSES.includes(status as InvoiceStatus);
}

export function shouldSetInvoiceFinanceLock(status: string): boolean {
  return shouldLockInvoiceOperationalState(status);
}

/** Lock assignments, deliverables, posts, and IO editing for an invoiced state. */
export async function lockInvoiceAssignments(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: { billingStatus?: string }
): Promise<{ lineIds: string[]; error?: string }> {
  return relockInvoiceOperationalScope(supabase, invoiceId, options);
}

/** Unlock assignments after unpost or void. */
export async function unlockInvoiceAssignments(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: { financeOverrideHours?: number }
): Promise<{ lineIds: string[]; error?: string }> {
  const result = await unlockInvoiceOperationalScope(supabase, invoiceId, {
    mode: "void",
    financeOverrideHours: options?.financeOverrideHours,
    preserveLineItems: false,
  });
  return { lineIds: result.lineIds, error: result.error };
}

/** Sync OPS + billing when invoice status changes. */
export async function syncInvoiceOperationalStates(
  supabase: SupabaseClient,
  invoiceId: string,
  status: string,
  actorId?: string | null
): Promise<void> {
  await ensureInvoiceFinanceDocument(supabase, invoiceId, actorId);

  if (shouldLockInvoiceOperationalState(status)) {
    const billingStatus =
      status === "paid"
        ? "paid"
        : status === "partial"
          ? "partially_paid"
          : "invoiced";
    await lockInvoiceAssignments(supabase, invoiceId, { billingStatus });
    await supabase
      .from("invoices")
      .update({ is_operational_locked: true } as never)
      .eq("id", invoiceId);
    return;
  }

  if (status === "void") {
    await unlockInvoiceAssignments(supabase, invoiceId);
    await supabase
      .from("invoices")
      .update({ is_operational_locked: false } as never)
      .eq("id", invoiceId);
  }
}
